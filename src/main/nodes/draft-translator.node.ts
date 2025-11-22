import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import pLimit from 'p-limit'
import { z } from 'zod'
import { cfg } from '../config'
import { CONCURRENT_LIMIT, DRAFT_CANDIDATE_COUNT } from '../constant'
import { fixTranslatedText, getParagraphsInRange } from '../utils/text-paragraph.utils'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './draft-translator.prompt.md'), 'utf-8')

export const DraftTranslatorOutputSchema = z.object({
  translatedText: z
    .string()
    .describe('The translated text segment in the target language, maintaining fidelity and style.')
})

export const draftTranslatorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  if (!state.sceneAnalysis?.scenes || state.sceneAnalysis.scenes.length === 0) {
    throw new Error('Scene analysis is required for scene-based translation')
  }

  if (!state.sourceText) {
    throw new Error('Source text is required')
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.7,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(DraftTranslatorOutputSchema)

  const limit = pLimit(CONCURRENT_LIMIT)

  const sceneTranslationPromises = state.sceneAnalysis.scenes.map((scene) => {
    return limit(async () => {
      const sourceSegment = getParagraphsInRange(state.sourceText, scene.startTag, scene.endTag)

      const userPrompt = `
##Target Language##
${state.targetLanguage}

##Source Segment##
${sourceSegment}

##Glossary##
${JSON.stringify(state.glossary)}

##Scene Context##
${JSON.stringify(scene)}`.trim()

      const messages = [
        {
          role: 'system',
          content: systemPrompt,
          cache_control: {
            type: 'ephemeral'
          }
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]

      const candidateLimit = pLimit(CONCURRENT_LIMIT)
      const candidatePromises = Array.from({ length: DRAFT_CANDIDATE_COUNT }, () =>
        candidateLimit(async () => {
          const result = await model.invoke(messages)
          const translatedSegment = result.translatedText

          try {
            return fixTranslatedText(translatedSegment, sourceSegment)
          } catch (error) {
            if (error instanceof Error) {
              throw new Error(
                `Invalid translated draft format for scene [${scene.startTag}-${scene.endTag}]: ${error.message}`
              )
            }
            throw error
          }
        })
      )

      const validatedCandidates = await Promise.all(candidatePromises)
      return validatedCandidates
    })
  })

  const sceneTranslations = await Promise.all(sceneTranslationPromises)

  return {
    sceneDrafts: sceneTranslations
  }
}
