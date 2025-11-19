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
    .enum(['Glossary Violation', 'Mistranslation', 'Omission', 'Addition'])
    .describe('The type of accuracy error found.'),
  sourceSegment: z
    .string()
    .describe('The specific segment from the source text where the error occurs.'),
  translatedSegment: z
    .string()
    .optional()
    .describe('The corresponding segment in the translated text (if applicable).'),
  feedback: z.string().describe('Feedback on the accuracy error found.')
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
