import '@langchain/langgraph/zod'

import { StateGraph } from '@langchain/langgraph'
import { z } from 'zod'
import { glossaryTranslatorNode, TranslatedEntitySchema } from '../nodes/glossary-translator.node'
import { NewTermSchema, termsEditorNode } from '../nodes/terms-editor.node'
import { termsExtractorNode } from '../nodes/terms-extractor.node'
import { LanguageEnum, TermSchema } from '../shared.types'

export const ExtractTermsInputStateSchema = z.object({
  chapterText: z.string().min(1000),
  knownTerms: z.array(TermSchema).default([]),
  targetLanguage: LanguageEnum,
  translationPhilosophy: z.string().optional()
})

export const ExtractTermsOverallStateSchema = ExtractTermsInputStateSchema.extend({
  candidateTerms: z.array(TermSchema).optional(),
  newTerms: z.array(NewTermSchema).optional(),
  translatedEntities: z.array(TranslatedEntitySchema).optional()
})

export const ExtractTermsOutputStateSchema = ExtractTermsOverallStateSchema.pick({
  newTerms: true,
  translatedEntities: true
})

export type ExtractTermsInputState = z.infer<typeof ExtractTermsInputStateSchema>
export type ExtractTermsOverallState = z.infer<typeof ExtractTermsOverallStateSchema>
export type ExtractTermsOutputState = z.infer<typeof ExtractTermsOutputStateSchema>

const builder = new StateGraph({
  state: ExtractTermsOverallStateSchema,
  input: ExtractTermsInputStateSchema,
  output: ExtractTermsOutputStateSchema
})
  .addNode('terms-extractor', termsExtractorNode)
  .addNode('terms-editor', termsEditorNode)
  .addNode('glossary-translator', glossaryTranslatorNode)
  .addEdge('__start__', 'terms-extractor')
  .addEdge('terms-extractor', 'terms-editor')
  .addEdge('terms-editor', 'glossary-translator')
  .addEdge('glossary-translator', '__end__')

export const graph = builder.compile()

graph.name = 'Extract Terms'
