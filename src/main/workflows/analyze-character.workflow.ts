import '@langchain/langgraph/zod'

import { StateGraph } from '@langchain/langgraph'
import { z } from 'zod'
import { characterAnalystNode, UpdatedCharacterSchema } from '../nodes/character-analyst.node'
import { characterIndexerNode } from '../nodes/character-indexer.node'
import { glossaryTranslatorNode, TranslatedEntitySchema } from '../nodes/glossary-translator.node'
import { CharacterSchema, LanguageEnum } from '../shared.types'

export const AnalyzeCharacterInputStateSchema = z.object({
  chapterText: z.string().min(1000),
  knownCharacters: z.array(CharacterSchema).default([]),
  targetLanguage: LanguageEnum,
  translationPhilosophy: z.string().optional()
})

export const AnalyzeCharacterOverallStateSchema = AnalyzeCharacterInputStateSchema.extend({
  candidateCharacters: z
    .array(CharacterSchema.omit({ gender: true, description: true }))
    .optional(),
  updatedCharacters: z.array(UpdatedCharacterSchema).optional(),
  newCharacterIds: z.array(z.uuid()).optional(),
  translatedEntities: z.array(TranslatedEntitySchema).optional()
})

export const AnalyzeCharacterOutputStateSchema = AnalyzeCharacterOverallStateSchema.pick({
  updatedCharacters: true,
  newCharacterIds: true,
  translatedEntities: true
})

export type AnalyzeCharacterInputState = z.infer<typeof AnalyzeCharacterInputStateSchema>
export type AnalyzeCharacterOverallState = z.infer<typeof AnalyzeCharacterOverallStateSchema>
export type AnalyzeCharacterOutputState = z.infer<typeof AnalyzeCharacterOutputStateSchema>

const builder = new StateGraph({
  state: AnalyzeCharacterOverallStateSchema,
  input: AnalyzeCharacterInputStateSchema,
  output: AnalyzeCharacterOutputStateSchema
})
  .addNode('character-indexer', characterIndexerNode)
  .addNode('character-analyst', characterAnalystNode)
  .addNode('glossary-translator', glossaryTranslatorNode)
  .addEdge('__start__', 'character-indexer')
  .addEdge('character-indexer', 'character-analyst')
  .addEdge('character-analyst', 'glossary-translator')
  .addEdge('glossary-translator', '__end__')

export const graph = builder.compile()

graph.name = 'Analyze Character'
