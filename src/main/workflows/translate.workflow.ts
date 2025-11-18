import '@langchain/langgraph/zod'

import { StateGraph } from '@langchain/langgraph'
import { z } from 'zod'
import { AccuracyErrorSchema, accuracyEditorNode } from '../nodes/accuracy-editor.node'
import { complexityAnalystNode, EditorTypeEnum } from '../nodes/complexity-analyst.node'
import { CulturalErrorSchema, culturalEditorNode } from '../nodes/cultural-editor.node'
import { draftTranslatorNode } from '../nodes/draft-translator.node'
import {
  EditorFeedbackEntrySchema,
  LeadEditorErrorSchema,
  leadEditorNode
} from '../nodes/lead-editor.node'
import { ReadabilityErrorSchema, readabilityEditorNode } from '../nodes/readability-editor.node'
import { refinementNode } from '../nodes/refinement.node'
import { StyleErrorSchema, styleEditorNode } from '../nodes/style-editor.node'
import { EditingStatusEnum, LanguageEnum } from '../shared.types'

export const TranslateInputStateSchema = z.object({
  targetLanguage: LanguageEnum,
  styleContext: z.object({
    genre: z.string(),
    authorialStyle: z.string()
  }),
  glossary: z.array(
    z.object({
      term: z.string(),
      category: z.string(),
      translation: z.string()
    })
  ),
  sourceText: z.string().min(1)
})

export const TranslateOverallStateSchema = TranslateInputStateSchema.extend({
  complexityScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe('The complexity score assigned by the complexity analyst (0-100).'),
  requiredEditors: z
    .array(EditorTypeEnum)
    .optional()
    .describe('The specialized editors required for this translation.'),
  complexityReason: z
    .string()
    .optional()
    .describe(
      'A brief explanation of the complexity analysis, including the key factors that influenced the score and editor selection.'
    ),
  translatedText: z
    .string()
    .optional()
    .describe('The translated text segment in the target language.'),
  accuracyScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe('The accuracy score assigned by the accuracy editor (0-100).'),
  accuracyFeedback: z
    .array(AccuracyErrorSchema)
    .optional()
    .describe('An array of specific accuracy errors found by the accuracy editor.'),
  styleScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe('The nuance & style score assigned by the style editor (0-100).'),
  styleFeedback: z
    .array(StyleErrorSchema)
    .optional()
    .describe('An array of specific style/nuance errors found by the style editor.'),
  readabilityScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe('The readability score assigned by the readability editor (0-100).'),
  readabilityFeedback: z
    .array(ReadabilityErrorSchema)
    .optional()
    .describe('An array of specific readability/flow errors found by the readability editor.'),
  culturalScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe('The cultural fidelity score assigned by the cultural editor (0-100).'),
  culturalFeedback: z
    .array(CulturalErrorSchema)
    .optional()
    .describe(
      'An array of specific cultural/idiomatic fidelity errors found by the cultural editor.'
    ),
  holisticScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe('The holistic score assigned by the lead editor (0-100).'),
  editorFeedback: z
    .array(LeadEditorErrorSchema)
    .optional()
    .describe('An array of conflicts that were detected and resolved by the lead editor.'),
  finalStatus: EditingStatusEnum.optional(),
  editorFeedbackHistory: z
    .array(EditorFeedbackEntrySchema)
    .optional()
    .describe('A chronological array of all editor feedback entries from the specialized editors.'),
  iterationCount: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('The number of translation iterations made so far.')
})

export const TranslateOutputStateSchema = TranslateOverallStateSchema.pick({
  translatedText: true,
  holisticScore: true,
  editorFeedback: true,
  finalStatus: true
})

export type TranslateInputState = z.infer<typeof TranslateInputStateSchema>
export type TranslateOverallState = z.infer<typeof TranslateOverallStateSchema>
export type TranslateOutputState = z.infer<typeof TranslateOutputStateSchema>

const builder = new StateGraph({
  state: TranslateOverallStateSchema,
  input: TranslateInputStateSchema,
  output: TranslateOutputStateSchema
})
  .addNode('complexity-analyst', complexityAnalystNode)
  .addNode('draft-translator', draftTranslatorNode)
  .addNode('accuracy-editor', accuracyEditorNode)
  .addNode('readability-editor', readabilityEditorNode)
  .addNode('style-editor', styleEditorNode)
  .addNode('cultural-editor', culturalEditorNode)
  .addNode('lead-editor', leadEditorNode)
  .addNode('refinement', refinementNode)
  .addEdge('__start__', 'complexity-analyst')
  .addEdge('complexity-analyst', 'draft-translator')
  .addEdge('draft-translator', 'accuracy-editor')
  .addEdge('draft-translator', 'readability-editor')
  .addEdge('draft-translator', 'style-editor')
  .addEdge('draft-translator', 'cultural-editor')
  .addEdge('refinement', 'accuracy-editor')
  .addEdge('refinement', 'readability-editor')
  .addEdge('refinement', 'style-editor')
  .addEdge('refinement', 'cultural-editor')
  .addEdge(
    ['accuracy-editor', 'readability-editor', 'style-editor', 'cultural-editor'],
    'lead-editor'
  )
  .addConditionalEdges(
    'lead-editor',
    (state) => {
      if (state.finalStatus === 'Final Edits Required' && state.editorFeedback?.length) {
        return 'REFINE'
      }
      return 'END'
    },
    {
      REFINE: 'refinement',
      END: '__end__'
    }
  )

export const graph = builder.compile()

graph.name = 'Translate Workflow'
