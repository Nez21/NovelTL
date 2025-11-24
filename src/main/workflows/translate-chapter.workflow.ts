import '@langchain/langgraph/zod'

import { StateGraph } from '@langchain/langgraph'
import { z } from 'zod'
import { AccuracyErrorSchema, accuracyEditorNode } from '../nodes/accuracy-editor.node'
import { draftSelectorNode } from '../nodes/draft-selector.node'
import { draftTranslatorNode } from '../nodes/draft-translator.node'
import { ReadabilityErrorSchema, readabilityEditorNode } from '../nodes/readability-editor.node'
import { SceneAnalystOutputSchema, sceneAnalystNode } from '../nodes/scene-analyst.node'
import { StyleErrorSchema, styleEditorNode } from '../nodes/style-editor.node'
import { synthesisEditorNode } from '../nodes/synthesis-editor.node'
import { CharacterSchema, LanguageEnum } from '../shared.types'

export const TranslateInputStateSchema = z.object({
  targetLanguage: LanguageEnum,
  globalContext: z.object({
    worldLaws: z.object({
      genreFramework: z.string(),
      temporalSetting: z.string(),
      magicLogic: z.string()
    }),
    narrativeVoice: z.object({
      perspectivePolicy: z.string(),
      translationPhilosophy: z.string()
    }),
    vocabularyConstraints: z.object({
      bannedCategories: z.array(z.string())
    })
  }),
  glossary: z.array(
    z.object({
      term: z.string(),
      category: z.string(),
      translation: z.string()
    })
  ),
  characterManifest: z.array(CharacterSchema.omit({ characterId: true })),
  sourceText: z.string().min(1)
})

export const TranslateOverallStateSchema = TranslateInputStateSchema.extend({
  sceneDrafts: z
    .array(z.array(z.string()))
    .optional()
    .describe('An array of scene translations, where each scene has multiple draft candidates.'),
  translatedText: z
    .string()
    .optional()
    .describe('The translated text segment in the target language.'),
  draftSelectionRationale: z
    .string()
    .optional()
    .describe('The rationale for why a specific draft candidate was selected.'),
  accuracyFeedback: z
    .array(AccuracyErrorSchema)
    .optional()
    .describe('An array of specific accuracy errors found by the accuracy editor.'),
  styleFeedback: z
    .array(StyleErrorSchema)
    .optional()
    .describe('An array of specific style/nuance errors found by the style editor.'),
  readabilityFeedback: z
    .array(ReadabilityErrorSchema)
    .optional()
    .describe('An array of specific readability/flow errors found by the readability editor.'),
  editCount: z.number().int().min(0).describe('The number of times the text has been re-edited.'),
  sceneAnalysis: SceneAnalystOutputSchema.optional().describe(
    'Scene segmentation and metadata analysis of the source text.'
  )
})

export const TranslateOutputStateSchema = TranslateOverallStateSchema.pick({
  translatedText: true
})

export type TranslateInputState = z.infer<typeof TranslateInputStateSchema>
export type TranslateOverallState = z.infer<typeof TranslateOverallStateSchema>
export type TranslateOutputState = z.infer<typeof TranslateOutputStateSchema>

const builder = new StateGraph({
  state: TranslateOverallStateSchema,
  input: TranslateInputStateSchema,
  output: TranslateOutputStateSchema
})
  .addNode('scene-analyst', sceneAnalystNode)
  .addNode('draft-translator', draftTranslatorNode)
  .addNode('draft-selector', draftSelectorNode)
  .addNode('accuracy-editor', accuracyEditorNode)
  .addNode('style-editor', styleEditorNode)
  .addNode('readability-editor', readabilityEditorNode)
  .addNode('synthesis-editor', synthesisEditorNode)
  .addEdge('__start__', 'scene-analyst')
  .addEdge('scene-analyst', 'draft-translator')
  .addEdge('draft-translator', 'draft-selector')
  .addEdge('draft-selector', 'accuracy-editor')
  .addEdge('draft-selector', 'style-editor')
  .addEdge('draft-selector', 'readability-editor')
  .addEdge(['accuracy-editor', 'style-editor', 'readability-editor'], 'synthesis-editor')
  .addConditionalEdges(
    'synthesis-editor',
    (state) => ((state.editCount || 0) < 2 ? 'CHECK' : 'END'),
    {
      CHECK: 'accuracy-editor',
      END: '__end__'
    }
  )
  .addEdge('accuracy-editor', 'synthesis-editor')

export const graph = builder.compile()

graph.name = 'Translate Chapter'
