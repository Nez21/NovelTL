import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './accuracy-editor.prompt.md'), 'utf-8')

export const AccuracyErrorSchema = z.object({
  type: z
    .enum([
      'Glossary Violation',
      'Hallucination',
      'Omission',
      'Mistranslation',
      'Entity Inconsistency',
      'Speaker Error'
    ])
    .describe('The specific category of factual or fidelity error.'),
  severity: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe(
      'Severity level: 1 = Minor nuance difference, 2 = Moderate mistranslation, 3 = Significant error, 4 = High severity (e.g., Entity inconsistency), 5 = Critical (Glossary violation or Hallucination).'
    ),
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
    .describe('An array of specific accuracy errors found. Empty if no errors.')
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

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.1,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(AccuracyEditorOutputSchema)

  const staticUserMessage = `
##Character Manifest##
${JSON.stringify(state.characterManifest)}

##Glossary##
${JSON.stringify(state.glossary)}

##Source Text##
${state.sourceText}`.trim()

  const dynamicUserMessage = `
##Translated Text##
${state.translatedText}`.trim()

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
      content: [
        {
          type: 'text',
          text: staticUserMessage,
          cache_control: {
            type: 'ephemeral'
          }
        },
        {
          type: 'text',
          text: dynamicUserMessage
        }
      ]
    }
  ]

  const result = await model.invoke(messages)

  return {
    accuracyScore: result.accuracyScore,
    accuracyFeedback: result.accuracyFeedback
  }
}
