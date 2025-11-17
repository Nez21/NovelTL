import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import { TermCategoryEnum } from '../shared.types'
import type { AnalyzeOverallState } from '../workflows/analyze.workflow'

const systemPrompt = readFileSync(join(__dirname, './terms-editor.prompt.md'), 'utf-8')

export const NewTermSchema = z.object({
  term: z.string().describe('The exact word or phrase extracted from the text.'),
  category: TermCategoryEnum.exclude(['Proper Nouns (Person)']).describe(
    'The preliminary category of the term.'
  ),
  description: z
    .string()
    .describe(
      "A context-specific note explaining the term's relevance and meaning in this chapter."
    )
})

export const TermsEditorOutputSchema = z.object({
  newTerms: z.array(NewTermSchema).describe('An array of new, complex terms requiring definition.')
})

export const termsEditorNode = async (
  state: AnalyzeOverallState,
  _config: RunnableConfig
): Promise<Partial<AnalyzeOverallState>> => {
  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.3,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: cfg.openrouterApiKey
    },
    modelKwargs: {
      reasoning: {
        max_tokens: -1
      }
    }
  }).withStructuredOutput(TermsEditorOutputSchema)

  const userPrompt = `
##Chapter Text##
${state.chapterText}

##Known Terms##
${JSON.stringify(state.knownTerms || [])}

##Candidate Terms##
${JSON.stringify(state.candidateTerms || [])}`.trim()

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  return {
    newTerms: result.newTerms
  }
}
