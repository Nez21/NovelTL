import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './readability-editor.prompt.md'), 'utf-8')

export const ReadabilityErrorSchema = z.object({
  type: z
    .enum(['Severe Translationese', 'Rhythm Paralysis', 'Critical Ambiguity'])
    .describe('Mechanical or flow-based linguistic errors.'),
  confidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      'Confidence in this specific error assessment from 0 (uncertain) to 100 (highly confident). Higher for objective grammar errors; lower for subjective flow preferences.'
    ),
  translatedSegment: z
    .string()
    .describe('The specific segment that is clunky, grammatically incorrect, or hard to read.'),
  feedback: z
    .string()
    .describe(
      'Must include: (1) an explanation of the awkwardness, and (2) at least one suggested fix (partial correction, not the entire segment) with smoother phrasing.'
    )
})

export const ReadabilityEditorOutputSchema = z.object({
  readabilityScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      'A readability score from 0 (unreadable) to 100 (flawless, natural prose that matches the style).'
    ),
  readabilityFeedback: z
    .array(ReadabilityErrorSchema)
    .describe('An array of specific readability/flow errors found. Empty if no errors.')
})

export const readabilityEditorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  if (!state.translatedText) {
    return {
      readabilityScore: 0,
      readabilityFeedback: []
    }
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.2,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(ReadabilityEditorOutputSchema)

  const staticUserMessage = `
##Target Language##
${state.targetLanguage}`.trim()

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
    readabilityScore: result.readabilityScore,
    readabilityFeedback: result.readabilityFeedback
  }
}
