import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import { TermSchema } from '../shared.types'
import type { AnalyzeOverallState } from '../workflows/analyze-chapter.workflow'

const systemPrompt = readFileSync(join(__dirname, './terms-extractor.prompt.md'), 'utf-8')

export const CandidateTermExtractorOutputSchema = z.object({
  candidateTerms: z
    .array(TermSchema)
    .describe(
      'A comprehensive, over-inclusive list of all potential "Hard Terms" extracted from the text, excluding character names.'
    )
})

export const termsExtractorNode = async (
  state: AnalyzeOverallState,
  _config: RunnableConfig
): Promise<Partial<AnalyzeOverallState>> => {
  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.1,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: cfg.openrouterApiKey
    }
  }).withStructuredOutput(CandidateTermExtractorOutputSchema)

  const userPrompt = `
##Chapter Text##
${state.chapterText}`.trim()

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  return {
    candidateTerms: result.candidateTerms
  }
}
