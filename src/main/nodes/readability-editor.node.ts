import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './readability-editor.prompt.md'), 'utf-8')

export const ReadabilityErrorSchema = z.object({
  type: z
    .enum(['Unnatural Syntax', 'Pacing Disruption'])
    .describe('The type of readability/flow error found.'),
  translatedSegment: z
    .string()
    .describe('The specific segment from the translated text where the readability issue occurs.'),
  feedback: z
    .string()
    .describe(
      'Detailed feedback explaining the readability/flow issue and how it affects the naturalness of the prose.'
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
    temperature: 0.5,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(ReadabilityEditorOutputSchema)

  const userPrompt = `
##Style Context##
${JSON.stringify(state.styleContext)}

##Target Language##
${state.targetLanguage}

##Translated Text##
${state.translatedText}`.trim()

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  return {
    readabilityScore: result.readabilityScore,
    readabilityFeedback: result.readabilityFeedback
  }
}
