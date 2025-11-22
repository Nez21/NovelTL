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

const systemPrompt = readFileSync(join(__dirname, './accuracy-editor.prompt.md'), 'utf-8')

export const AccuracyErrorSchema = z.object({
  paragraphId: z.string().describe('The paragraph ID (e.g., [P1]) where the error was found.'),
  type: z
    .enum(['Structural & Data Integrity', 'Logic & State Violation', 'Social Dynamic Error'])
    .describe('The specific category of factual or fidelity error.'),
  confidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      'Confidence in this specific error assessment from 0 (uncertain) to 100 (highly confident). Higher for clear-cut errors (e.g., Glossary violations); lower for judgment calls (e.g., subtle nuance differences).'
    ),
  sourceSegment: z
    .string()
    .describe('The specific substring from the Source Text where the error originates.'),
  translatedSegment: z
    .string()
    .describe('The corresponding substring in the Translation that contains the error.'),
  feedback: z
    .string()
    .describe(
      'Must include: (1) a concise explanation of the deviation, and (2) at least one suggested fix (partial correction, not the entire segment). For Glossary violations, state the required term and provide the corrected phrase.'
    )
})

export const AccuracyEditorOutputSchema = z.object({
  accuracyScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('An accuracy score from 0 (total mistranslation) to 100 (perfect 1:1 accuracy).'),
  accuracyFeedback: z
    .array(AccuracyErrorSchema)
    .describe(
      'An array of specific accuracy errors found. Empty if no errors. Each error must include the paragraphId where it occurs.'
    )
})

export const accuracyEditorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  if (!state.translatedText) {
    return {
      accuracyScore: 0,
      accuracyFeedback: []
    }
  }

  if (!state.sceneAnalysis?.scenes || state.sceneAnalysis.scenes.length === 0) {
    throw new Error('Scene analysis is required for scene-based accuracy checking')
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
    temperature: 0.1,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: 2048 } }
  }).withStructuredOutput(AccuracyEditorOutputSchema)

  const limit = pLimit(CONCURRENT_LIMIT)

  const sceneAccuracyPromises = state.sceneAnalysis.scenes.map((scene) => {
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

  const sceneResults = await Promise.all(sceneAccuracyPromises)

  const allErrors = sceneResults.flatMap((result) => result.accuracyFeedback)
  const averageScore = Math.round(
    sceneResults.reduce((sum, result) => sum + result.accuracyScore, 0) / sceneResults.length
  )

  return {
    accuracyScore: averageScore,
    accuracyFeedback: allErrors
  }
}
