import '@langchain/langgraph/zod'

import { StateGraph } from '@langchain/langgraph'
import { z } from 'zod'
import { characterAnalystNode, UpdatedCharacterSchema } from '../nodes/character-analyst.node'
import { characterIndexerNode } from '../nodes/character-indexer.node'
import { glossaryTranslatorNode, TranslatedEntitySchema } from '../nodes/glossary-translator.node'
import { NewTermSchema, termsEditorNode } from '../nodes/terms-editor.node'
import { termsExtractorNode } from '../nodes/terms-extractor.node'
import { CharacterSchema, LanguageEnum, TermSchema } from '../shared.types'

export const AnalyzeInputStateSchema = z.object({
  chapterText: z.string().min(1000),
  knownTerms: z.array(TermSchema).default([]),
  knownCharacters: z.array(CharacterSchema).default([]),
  targetLanguage: LanguageEnum
})

export const AnalyzeOverallStateSchema = AnalyzeInputStateSchema.extend({
  candidateCharacters: z
    .array(CharacterSchema.omit({ gender: true, description: true }))
    .optional(),
  candidateTerms: z.array(TermSchema).optional(),
  updatedCharacters: z.array(UpdatedCharacterSchema).optional(),
  newCharacterIds: z.array(z.uuid()).optional(),
  newTerms: z.array(NewTermSchema).optional(),
  translatedEntities: z.array(TranslatedEntitySchema).optional()
})

export const AnalyzeOutputStateSchema = AnalyzeOverallStateSchema.pick({
  updatedCharacters: true,
  newCharacterIds: true,
  newTerms: true,
  translatedEntities: true
})

export type AnalyzeInputState = z.infer<typeof AnalyzeInputStateSchema>
export type AnalyzeOverallState = z.infer<typeof AnalyzeOverallStateSchema>
export type AnalyzeOutputState = z.infer<typeof AnalyzeOutputStateSchema>

const builder = new StateGraph({
  state: AnalyzeOverallStateSchema,
  input: AnalyzeInputStateSchema,
  output: AnalyzeOutputStateSchema
})
  .addNode('character-indexer', characterIndexerNode)
  .addNode('character-analyst', characterAnalystNode)
  .addNode('terms-extractor', termsExtractorNode)
  .addNode('terms-editor', termsEditorNode)
  .addNode('glossary-translator', glossaryTranslatorNode)
  .addEdge('__start__', 'character-indexer')
  .addEdge('__start__', 'terms-extractor')
  .addEdge('character-indexer', 'character-analyst')
  .addEdge('terms-extractor', 'terms-editor')
  .addEdge(['character-analyst', 'terms-editor'], 'glossary-translator')
  .addEdge('glossary-translator', '__end__')

export const graph = builder.compile()

graph.name = 'Analyze Workflow'
