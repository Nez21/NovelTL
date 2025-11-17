import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './translator.prompt.md'), 'utf-8')

export const TranslatorOutputSchema = z.object({
  translatedText: z
    .string()
    .describe('The translated text segment in the target language, maintaining fidelity and style.')
})

export const translatorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  let modelType: string = 'google/gemini-2.5-flash'

  if (state.complexityScore && state.complexityScore >= 70) {
    modelType = 'google/gemini-2.5-pro'
  }

  const model = new ChatOpenAI({
    model: modelType,
    temperature: state.attemptCount ? 0.2 : 0.7,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(TranslatorOutputSchema)

  let userPrompt = `
##Source Text##
${state.sourceText}

##Target Language##
${state.targetLanguage}

##Style Context##
${JSON.stringify(state.styleContext)}

##Glossary##
${JSON.stringify(state.glossary)}`.trim()

  if (state.editorFeedback?.length) {
    userPrompt += `
##Previous Translation##
${state.translatedText}

##Editor Feedback##
${JSON.stringify(state.editorFeedback)}`.trim()
  }

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  const isRetry = (state.attemptCount ?? 0) > 0

  return {
    attemptCount: (state.attemptCount ?? 0) + 1,
    translatedText: result.translatedText,
    ...(isRetry && {
      accuracyScore: undefined,
      accuracyFeedback: undefined,
      styleScore: undefined,
      styleFeedback: undefined,
      readabilityScore: undefined,
      readabilityFeedback: undefined,
      culturalScore: undefined,
      culturalFeedback: undefined,
      holisticScore: undefined,
      editorFeedback: undefined
    })
  }
}
