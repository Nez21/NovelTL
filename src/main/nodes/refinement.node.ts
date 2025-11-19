import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './refinement.prompt.md'), 'utf-8')

export const RefinementOutputSchema = z.object({
  translatedText: z
    .string()
    .describe(
      'The full, corrected, and finalized translation text with all required fixes applied.'
    )
})

export const refinementNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  if (!state.translatedText || !state.editorFeedback?.length) {
    return {}
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.3,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey }
    // modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(RefinementOutputSchema)

  const staticUserMessage = `
##Source Text##
${state.sourceText}`.trim()

  const dynamicUserMessage = `
##Draft for Revision##
${state.translatedText}

##Required Fixes##
${JSON.stringify(state.editorFeedback)}`.trim()

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
    iterationCount: (state.iterationCount ?? 0) + 1,
    translatedText: result.translatedText
  }
}
