import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import pLimit from 'p-limit'
import { z } from 'zod'
import { cfg } from '../config'
import { CONCURRENT_LIMIT, READABILITY_CONTEXT_SIZE, READABILITY_WINDOW_SIZE } from '../constant'
import { parseParagraphs } from '../utils/text-paragraph.utils'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './readability-editor.prompt.md'), 'utf-8')

export const ReadabilityErrorSchema = z.object({
  paragraphId: z.string().describe('The paragraph ID (e.g., [P1]) where the error was found.'),
  type: z
    .enum(['Unnatural Syntax', 'Rhythm Stagnation', 'Ambiguity'])
    .describe('The category of readability or flow error.'),
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
    .describe(
      'An array of specific readability/flow errors found. Empty if no errors. Each error must include the paragraphId where it occurs.'
    )
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

  const paragraphs = parseParagraphs(state.translatedText)
  if (paragraphs.length === 0) {
    return {
      readabilityScore: 0,
      readabilityFeedback: []
    }
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.4,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey }
  }).withStructuredOutput(ReadabilityEditorOutputSchema)

  const staticUserMessage = `
##Target Language##
${state.targetLanguage}`.trim()

  const limit = pLimit(CONCURRENT_LIMIT)

  const windowPromises: Array<Promise<z.infer<typeof ReadabilityEditorOutputSchema>>> = []

  for (let i = 0; i < paragraphs.length; i += READABILITY_WINDOW_SIZE) {
    const windowStart = i
    const windowEnd = Math.min(i + READABILITY_WINDOW_SIZE, paragraphs.length)
    const contextStart = Math.max(0, windowStart - READABILITY_CONTEXT_SIZE)
    const contextEnd = Math.min(paragraphs.length, windowEnd + READABILITY_CONTEXT_SIZE)

    windowPromises.push(
      limit(async () => {
        const previousParagraphs = paragraphs.slice(contextStart, windowStart)
        const activeParagraphs = paragraphs.slice(windowStart, windowEnd)
        const nextParagraphs = paragraphs.slice(windowEnd, contextEnd)

        const previousContext = previousParagraphs
          .map((para) => `${para.id} ${para.content}`)
          .join('\n')
        const activeWindow = activeParagraphs.map((para) => `${para.id} ${para.content}`).join('\n')
        const nextContext = nextParagraphs.map((para) => `${para.id} ${para.content}`).join('\n')

        const dynamicUserMessage = `
##Previous Context##
${previousContext || '(No previous context)'}

##Active Window##
${activeWindow}

##Next Context##
${nextContext || '(No next context)'}`.trim()

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
        return result
      })
    )
  }

  const windowResults = await Promise.all(windowPromises)

  const allErrors = windowResults.flatMap((result) => result.readabilityFeedback)
  const averageScore = Math.round(
    windowResults.reduce((sum, result) => sum + result.readabilityScore, 0) / windowResults.length
  )

  return {
    readabilityScore: averageScore,
    readabilityFeedback: allErrors
  }
}
