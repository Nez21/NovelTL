import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './draft-translator.prompt.md'), 'utf-8')

export const DraftTranslatorOutputSchema = z.object({
  translatedText: z
    .string()
    .describe('The translated text segment in the target language, maintaining fidelity and style.')
})

export const draftTranslatorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.7,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(DraftTranslatorOutputSchema)

  const userPrompt = `
##Target Language##
${state.targetLanguage}

##Style Context##
${JSON.stringify(state.styleContext)}

##Glossary##
${JSON.stringify(state.glossary)}

##Source Text##
${state.sourceText}`.trim()

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  return {
    iterationCount: 1,
    translatedText: result.translatedText
  }
}
