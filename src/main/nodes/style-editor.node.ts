import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import pLimit from 'p-limit'
import { z } from 'zod'
import { cfg } from '../config'
import { CONCURRENT_LIMIT } from '../constant'
import { getParagraphsInRange, hasParagraphIds } from '../utils/text-paragraph.utils'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './style-editor.prompt.md'), 'utf-8')

export const StyleErrorSchema = z.object({
  paragraphId: z.string().describe('The paragraph ID (e.g., [P1]) where the error was found.'),
  type: z
    .enum(['Atmospheric Dissonance', 'Voice Inconsistency', 'Stylistic Dilution'])
    .describe('The category of stylistic divergence.'),
  confidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      'Confidence in this specific error assessment from 0 (uncertain) to 100 (highly confident). Higher for objective issues (e.g., clear tone mismatches); lower for subjective stylistic preferences.'
    ),
  translatedSegment: z
    .string()
    .describe("The specific phrase or sentence that feels 'off' or weak."),
  feedback: z
    .string()
    .describe(
      'Must include: (1) a critique explaining *why* it fails the Style Context, and (2) at least one suggested fix (partial correction, not the entire segment).'
    )
})

export const StyleEditorOutputSchema = z.object({
  styleScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      'A nuance & style score from 0 (completely flat, wrong tone) to 100 (perfectly captures the authorial voice).'
    ),
  styleFeedback: z
    .array(StyleErrorSchema)
    .describe(
      'An array of specific style/nuance errors found. Empty if no errors. Each error must include the paragraphId where it occurs.'
    )
})

export const styleEditorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  if (!state.translatedText) {
    return {
      styleScore: 0,
      styleFeedback: []
    }
  }

  if (!state.sceneAnalysis?.scenes || state.sceneAnalysis.scenes.length === 0) {
    throw new Error('Scene analysis is required for scene-based style checking')
  }

  if (!state.sourceText) {
    throw new Error('Source text is required')
  }

  if (!hasParagraphIds(state.translatedText)) {
    throw new Error(
      'Translated text must contain paragraph IDs for accurate scene-based validation. Please ensure draft-translator and draft-selector preserve paragraph IDs.'
    )
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.3,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: 2048 } }
  }).withStructuredOutput(StyleEditorOutputSchema)

  const limit = pLimit(CONCURRENT_LIMIT)

  const sceneStylePromises = state.sceneAnalysis.scenes.map((scene) => {
    return limit(async () => {
      const sourceSegment = getParagraphsInRange(state.sourceText, scene.startTag, scene.endTag)
      const translatedSegment = getParagraphsInRange(
        state.translatedText!,
        scene.startTag,
        scene.endTag
      )

      const userPrompt = `
##Target Language##
${state.targetLanguage}

##Glossary##
${JSON.stringify(state.glossary)} 
 
##Scene Context##
${JSON.stringify(scene)}

##Source Segment##
${sourceSegment}

##Translated Segment##
${translatedSegment}`.trim()

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

      const result = await model.invoke(messages)

      return result
    })
  })

  const sceneResults = await Promise.all(sceneStylePromises)

  const allErrors = sceneResults.flatMap((result) => result.styleFeedback)
  const averageScore = Math.round(
    sceneResults.reduce((sum, result) => sum + result.styleScore, 0) / sceneResults.length
  )

  return {
    styleScore: averageScore,
    styleFeedback: allErrors
  }
}
