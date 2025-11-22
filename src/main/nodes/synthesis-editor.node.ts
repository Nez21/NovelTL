import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import { fixAnnotatedText, removeParagraphIds } from '../utils/text-paragraph.utils'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './synthesis-editor.prompt.md'), 'utf-8')

export const SynthesisEditorOutputSchema = z.object({
  revisedText: z
    .string()
    .describe(
      'The complete revised text with all paragraph IDs preserved. If paragraphs are split, use sub-tags like [P1a] and [P1b].'
    )
})

export const synthesisEditorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  if (!state.translatedText) {
    throw new Error('Translated text is required for synthesis editing')
  }

  if (!state.sourceText) {
    throw new Error('Source text is required for synthesis editing')
  }

  if (!state.sceneAnalysis?.scenes || state.sceneAnalysis.scenes.length === 0) {
    throw new Error('Scene analysis is required for synthesis editing')
  }

  const accuracyReport = (state.accuracyFeedback || []).map((error) => ({
    paragraphId: error.paragraphId,
    type: error.type,
    translatedSegment: error.translatedSegment,
    feedback: error.feedback
  }))

  const styleReport = (state.styleFeedback || []).map((error) => ({
    paragraphId: error.paragraphId,
    type: error.type,
    translatedSegment: error.translatedSegment,
    feedback: error.feedback
  }))

  const readabilityReport = (state.readabilityFeedback || []).map((error) => ({
    paragraphId: error.paragraphId,
    type: error.type,
    translatedSegment: error.translatedSegment,
    feedback: error.feedback
  }))

  const scores = [state.accuracyScore, state.styleScore, state.readabilityScore].filter(
    Boolean
  ) as number[]
  const holisticScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  if (!accuracyReport.length && !styleReport.length && !readabilityReport.length) {
    return {
      translatedText: removeParagraphIds(state.translatedText || ''),
      holisticScore: state.accuracyScore,
      editCount: Number.MAX_SAFE_INTEGER
    }
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.1,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: 1024 } }
  }).withStructuredOutput(SynthesisEditorOutputSchema)

  const userPrompt = `
##Target Language##
${state.targetLanguage}

##Source Text##
${state.sourceText}

##Glossary##
${JSON.stringify(state.glossary)} 

##Scene Context##
${JSON.stringify(state.sceneAnalysis.scenes)}

##Draft Text##
${state.translatedText}

##Critique Reports##
${JSON.stringify({ accuracyReport, styleReport, readabilityReport })}`.trim()

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
      content: userPrompt
    }
  ]

  const result = await model.invoke(messages)

  return {
    translatedText: fixAnnotatedText(result.revisedText),
    holisticScore,
    editCount: (state.editCount || 0) + 1,
    accuracyFeedback: [],
    styleFeedback: [],
    readabilityFeedback: []
  }
}
