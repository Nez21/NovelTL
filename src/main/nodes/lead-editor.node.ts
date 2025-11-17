import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import { DEFAULT_ACCEPTABLE_SCORE, MAX_EDIT_ATTEMPTS, MIN_ACCEPTABLE_SCORE } from '../constant'
import type { EditingStatusEnum } from '../shared.types'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './lead-editor.prompt.md'), 'utf-8')

export const EditorFeedbackEntrySchema = z.object({
  role: z
    .enum([
      'Accuracy Editor',
      'Style Editor',
      'Cultural Editor',
      'Readability Editor',
      'Lead Editor'
    ])
    .describe('The role of the editor providing feedback.'),
  feedback: z
    .array(
      z.object({
        type: z.string().describe('The type of error found.'),
        sourceSegment: z
          .string()
          .optional()
          .describe('The specific segment from the source text (if applicable).'),
        translatedSegment: z
          .string()
          .optional()
          .describe('The specific segment from the translated text (if applicable).'),
        feedback: z.string().describe('Detailed feedback explaining the issue.')
      })
    )
    .describe('An array of feedback found by this editor.')
})

export const LeadEditorErrorSchema = z.object({
  type: z.string().describe('The original type of error that was detected by the editor.'),
  sourceSegment: z
    .string()
    .optional()
    .describe('The specific segment from the source text (if applicable).'),
  translatedSegment: z
    .string()
    .optional()
    .describe('The specific segment from the translated text (if applicable).'),
  feedback: z.string().describe('The original feedback by the editor')
})

export const LeadEditorOutputSchema = z.object({
  feedback: z
    .array(LeadEditorErrorSchema)
    .describe('An array of feedback with conflict resolutions.')
})

export const leadEditorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  const recentEditorFeedback: z.infer<typeof EditorFeedbackEntrySchema>[] = []

  if (state.accuracyFeedback?.length) {
    recentEditorFeedback.push({
      role: 'Accuracy Editor',
      feedback: state.accuracyFeedback
    })
  }

  if (state.styleFeedback?.length) {
    recentEditorFeedback.push({
      role: 'Style Editor',
      feedback: state.styleFeedback
    })
  }

  if (state.culturalFeedback?.length) {
    recentEditorFeedback.push({
      role: 'Cultural Editor',
      feedback: state.culturalFeedback
    })
  }

  if (state.readabilityFeedback?.length) {
    recentEditorFeedback.push({
      role: 'Readability Editor',
      feedback: state.readabilityFeedback
    })
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.1,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(LeadEditorOutputSchema)

  const userPrompt = `
##Style Context##
${JSON.stringify(state.styleContext)}

##Source Text##
${state.sourceText}

##Translated Text##
${state.translatedText}

##Feedback History##
${JSON.stringify(state.editorFeedbackHistory ?? [])}

##Recent Feedback##
${JSON.stringify(recentEditorFeedback)}`.trim()

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  const scores = [
    state.accuracyScore,
    state.styleScore,
    state.culturalScore,
    state.readabilityScore
  ].filter(Boolean) as number[]

  const holisticScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  let finalStatus: z.infer<typeof EditingStatusEnum>

  if (state.attemptCount === MAX_EDIT_ATTEMPTS || holisticScore < MIN_ACCEPTABLE_SCORE) {
    finalStatus = 'Escalated To Human'
  } else if (
    state.attemptCount > 1 &&
    (result.feedback.length > 0 || holisticScore < DEFAULT_ACCEPTABLE_SCORE)
  ) {
    finalStatus = 'Final Edits Required'
  } else {
    finalStatus = 'Approved'
  }

  const editorFeedbackHistory = [...(state.editorFeedbackHistory ?? []), ...recentEditorFeedback]

  return {
    holisticScore,
    editorFeedback: result.feedback,
    finalStatus,
    editorFeedbackHistory
  }
}
