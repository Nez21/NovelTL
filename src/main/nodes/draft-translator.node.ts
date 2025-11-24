import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import pLimit from 'p-limit'
import { cfg } from '../config'
import { CONCURRENT_LIMIT, DRAFT_CANDIDATE_COUNT } from '../constant'
import { fixAnnotatedText, getParagraphsInRange } from '../utils/text-paragraph.utils'
import type { TranslateOverallState } from '../workflows/translate-chapter.workflow'

const systemPrompt = readFileSync(join(__dirname, './draft-translator.prompt.md'), 'utf-8')

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
    modelKwargs: { reasoning: { max_tokens: 1024 } }
  })

  const limit = pLimit(CONCURRENT_LIMIT)

  const sceneTranslationPromises = state.sceneAnalysis.scenes.map((scene) => {
    return limit(async () => {
      const sourceSegment = getParagraphsInRange(state.sourceText, scene.startTag, scene.endTag)

      const userPrompt = `
##Target Language##
${state.targetLanguage}

##Global Context##
${JSON.stringify(state.globalContext)}

##Glossary##
${JSON.stringify(state.glossary)}

##Scene Context##
${JSON.stringify(scene)}

##Source Segment##
${sourceSegment}`.trim()

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
          const translatedSegment =
            typeof result.content === 'string'
              ? result.content
              : result.content.map((block) => block.text).join('\n')

          return fixAnnotatedText(translatedSegment)
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
