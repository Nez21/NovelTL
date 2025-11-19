import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './draft-selector.prompt.md'), 'utf-8')

export const DraftSelectorOutputSchema = z.object({
  selectedIndex: z
    .number()
    .int()
    .min(0)
    .describe('The 0-based index of the selected draft candidate.'),
  rationale: z
    .string()
    .describe('A brief explanation of why this draft was selected over the others.')
})

export const draftSelectorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  if (!state.draftCandidates?.length) {
    return {}
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.1,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(DraftSelectorOutputSchema)

  const userPrompt = `
##Target Language##
${state.targetLanguage}

##Style Context##
${JSON.stringify(state.styleContext)}

##Glossary##
${JSON.stringify(state.glossary)}

##Source Text##
${state.sourceText}

##Draft Candidates##
${JSON.stringify(state.draftCandidates)}`.trim()

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  // Validate the selected index is within bounds
  const selectedIndex = Math.max(
    0,
    Math.min(result.selectedIndex, state.draftCandidates.length - 1)
  )
  const selectedText = state.draftCandidates[selectedIndex]

  return {
    translatedText: selectedText,
    draftSelectionRationale: result.rationale
  }
}
