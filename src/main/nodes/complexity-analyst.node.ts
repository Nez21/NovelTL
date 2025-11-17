import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './complexity-analyst.prompt.md'), 'utf-8')

export const EditorTypeEnum = z.enum(['Style', 'Cultural'])

export const ComplexityAnalysisOutputSchema = z.object({
  complexityScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      'A complexity score from 0 (simple, literal narration) to 100 (highly idiomatic, stylistic, or poetic prose).'
    ),
  requiredEditors: z
    .array(EditorTypeEnum)
    .describe(
      'An array of specialized editors required for this text. If the text is simple, return an empty array.'
    ),
  reason: z
    .string()
    .describe(
      'A brief explanation of the complexity analysis, including the key factors that influenced the score and editor selection.'
    )
})

export const complexityAnalystNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.1,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: cfg.openrouterApiKey
    },
    modelKwargs: {
      reasoning: {
        max_tokens: -1
      }
    }
  }).withStructuredOutput(ComplexityAnalysisOutputSchema)

  const userPrompt = `
##Source Text##
${state.sourceText}`.trim()

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  return {
    complexityScore: result.complexityScore,
    requiredEditors: result.requiredEditors,
    complexityReason: result.reason
  }
}
