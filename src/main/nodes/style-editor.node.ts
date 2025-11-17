import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './style-editor.prompt.md'), 'utf-8')

export const StyleErrorSchema = z.object({
  type: z
    .enum(['Tone Mismatch', 'Voice Inconsistency', 'Diction Level', 'Lost Literary Devices'])
    .describe('The type of style/nuance error found.'),
  sourceSegment: z
    .string()
    .describe('The specific segment from the source text where the style issue occurs.'),
  translatedSegment: z.string().describe('The corresponding segment in the translated text.'),
  feedback: z
    .string()
    .describe(
      'Detailed feedback explaining the style/nuance issue and how it affects the translation.'
    )
})

export const StyleEditorOutputSchema = z.object({
  styleScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      'A nuance & style score from 0 (completely flat, wrong tone) to 100 (perfectly captures the authorial voice).'
    ),
  styleFeedback: z
    .array(StyleErrorSchema)
    .describe('An array of specific style/nuance errors found. Empty if no errors.')
})

export const styleEditorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  if (!state.translatedText) {
    return {
      styleScore: 0,
      styleFeedback: []
    }
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.7,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(StyleEditorOutputSchema)

  const userPrompt = `
##Style Context##
${JSON.stringify(state.styleContext)}

##Target Language##
${state.targetLanguage}

##Source Text##
${state.sourceText}

##Translated Text##
${state.translatedText}`.trim()

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  return {
    styleScore: result.styleScore,
    styleFeedback: result.styleFeedback
  }
}
