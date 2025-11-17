import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const draftSystemPrompt = readFileSync(join(__dirname, './translator.prompt.md'), 'utf-8')
const refinementSystemPrompt = readFileSync(join(__dirname, './refinement.prompt.md'), 'utf-8')

export const TranslatorOutputSchema = z.object({
  translatedText: z
    .string()
    .describe('The translated text segment in the target language, maintaining fidelity and style.')
})

export const translatorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  const isRefinement = state.editorFeedback && state.editorFeedback.length > 0

  const systemPrompt = isRefinement ? refinementSystemPrompt : draftSystemPrompt

  let modelType: string = 'google/gemini-2.5-flash'

  if (!isRefinement && state.complexityScore && state.complexityScore >= 70) {
    modelType = 'google/gemini-2.5-pro'
  }

  const temperature = isRefinement ? 0.3 : 0.7

  const model = new ChatOpenAI({
    model: modelType,
    temperature,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(TranslatorOutputSchema)

  let userPrompt: string

  if (isRefinement) {
    userPrompt = `
##Target Language##
${state.targetLanguage}

##Style Context##
${JSON.stringify(state.styleContext)}

##Glossary##
${JSON.stringify(state.glossary)}

##Source Text##
${state.sourceText}

##Draft for Revision##
${state.translatedText}

##Required Fixes##
${JSON.stringify(state.editorFeedback)}`.trim()
  } else {
    userPrompt = `
##Target Language##
${state.targetLanguage}

##Style Context##
${JSON.stringify(state.styleContext)}

##Glossary##
${JSON.stringify(state.glossary)}

##Source Text##
${state.sourceText}`.trim()
  }

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  const iterationCount = isRefinement ? (state.iterationCount ?? 0) + 1 : 1

  return {
    iterationCount,
    translatedText: result.translatedText
  }
}
