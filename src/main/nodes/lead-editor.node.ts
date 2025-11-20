import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import { DEFAULT_ACCEPTABLE_SCORE, MAX_EDIT_ITERATIONS, MIN_ACCEPTABLE_SCORE } from '../constant'
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
        severity: z.number().int().min(1).max(5).describe('Severity level from 1 to 5.'),
        confidence: z.number().int().min(0).max(100).describe('Confidence level from 0 to 100.'),
        sourceSegment: z
          .string()
          .optional()
          .describe('The specific segment from the source text (if applicable).'),
        translatedSegment: z.string().describe('The specific segment from the translated text.'),
        feedback: z.string().describe('Detailed feedback explaining the issue.')
      })
    )
    .describe('An array of feedback found by this editor.')
})

export const LeadEditorErrorSchema = z.object({
  type: z.string().describe('The original type of error that was detected by the editor.'),
  severity: z.number().int().min(1).max(5).optional().describe('Severity level from 1 to 5.'),
  confidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe('Confidence level from 0 to 100.'),
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

export const LeadEditorOutputSchema = z
  .array(EditorFeedbackEntrySchema)
  .describe('The filtered and approved subset of Recent Feedback, matching the input structure.')

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

  const scores = [
    state.accuracyScore,
    state.styleScore,
    state.culturalScore,
    state.readabilityScore
  ].filter(Boolean) as number[]
  const holisticScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  if (
    state.iterationCount > MAX_EDIT_ITERATIONS ||
    recentEditorFeedback.flatMap(({ feedback }) => feedback).length === 0
  ) {
    // Flatten feedback for backward compatibility
    const flattenedFeedback: z.infer<typeof LeadEditorErrorSchema>[] = recentEditorFeedback.flatMap(
      ({ feedback }) =>
        feedback.map((item) => ({
          type: item.type,
          severity: item.severity,
          confidence: item.confidence,
          sourceSegment: item.sourceSegment,
          translatedSegment: item.translatedSegment,
          feedback: item.feedback
        }))
    )

    return {
      holisticScore,
      finalStatus: holisticScore < MIN_ACCEPTABLE_SCORE ? 'Escalated To Human' : 'Approved',
      editorFeedback: flattenedFeedback
    }
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.1,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(LeadEditorOutputSchema)

  const staticUserMessage = `
##Style Context##
${JSON.stringify(state.styleContext)}

##Character Manifest##
${JSON.stringify(state.characterManifest)}

##Glossary##
${JSON.stringify(state.glossary)}

##Source Text##
${state.sourceText}`.trim()

  const dynamicUserMessage = `
##Translated Text##
${state.translatedText}

##Feedback History##
${JSON.stringify(state.editorFeedbackHistory ?? [])}

##Recent Feedback##
${JSON.stringify(recentEditorFeedback)}`.trim()

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

  const approvedFeedback = await model.invoke(messages)

  // Flatten the approved feedback for backward compatibility with editorFeedback field
  const flattenedFeedback: z.infer<typeof LeadEditorErrorSchema>[] = approvedFeedback.flatMap(
    ({ feedback }) =>
      feedback.map((item) => ({
        type: item.type,
        severity: item.severity,
        confidence: item.confidence,
        sourceSegment: item.sourceSegment,
        translatedSegment: item.translatedSegment,
        feedback: item.feedback
      }))
  )

  let finalStatus: z.infer<typeof EditingStatusEnum> = 'Final Edits Required'

  if (
    (state.iterationCount > 1 && holisticScore >= DEFAULT_ACCEPTABLE_SCORE) ||
    flattenedFeedback.length === 0
  ) {
    finalStatus = 'Approved'
  }

  const editorFeedbackHistory = [...(state.editorFeedbackHistory ?? []), ...recentEditorFeedback]

  return {
    holisticScore,
    editorFeedback: flattenedFeedback,
    finalStatus,
    editorFeedbackHistory
  }
}
