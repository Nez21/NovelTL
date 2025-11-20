import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './style-editor.prompt.md'), 'utf-8')

export const StyleErrorSchema = z.object({
  type: z
    .enum(['Stylistic Dilution', 'Voice Inconsistency', 'Tonal Dissonance'])
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
    .describe('An array of specific style/nuance errors found. Empty if no errors.')
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

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.3,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(StyleEditorOutputSchema)

  const staticUserMessage = `
##Target Language##
${state.targetLanguage}

##Style Context##
${JSON.stringify(state.styleContext)}

##Character Manifest##
${JSON.stringify(state.characterManifest)}

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
    styleScore: result.styleScore,
    styleFeedback: result.styleFeedback
  }
}
