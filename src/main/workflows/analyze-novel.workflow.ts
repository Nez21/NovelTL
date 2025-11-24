import '@langchain/langgraph/zod'

import { StateGraph } from '@langchain/langgraph'
import { z } from 'zod'
import { GlobalContextSchema, novelAnalystNode } from '../nodes/novel-analyst.node'

export const GlobalContextInputStateSchema = z.object({
  textSample: z
    .string()
    .min(100)
    .describe(
      'A representative text sample, ideally 2,000+ tokens, covering narration, dialogue, and combat/action'
    )
})

export const GlobalContextOverallStateSchema = GlobalContextInputStateSchema.extend({
  globalContext: GlobalContextSchema.optional().describe(
    'The constructed Global Context containing world laws, narrative voice, and vocabulary constraints'
  )
})

export const GlobalContextOutputStateSchema = GlobalContextOverallStateSchema.pick({
  globalContext: true
})

export type GlobalContextInputState = z.infer<typeof GlobalContextInputStateSchema>
export type GlobalContextOverallState = z.infer<typeof GlobalContextOverallStateSchema>
export type GlobalContextOutputState = z.infer<typeof GlobalContextOutputStateSchema>

const builder = new StateGraph({
  state: GlobalContextOverallStateSchema,
  input: GlobalContextInputStateSchema,
  output: GlobalContextOutputStateSchema
})
  .addNode('novel-analyst', novelAnalystNode)
  .addEdge('__start__', 'novel-analyst')
  .addEdge('novel-analyst', '__end__')

export const graph = builder.compile()

graph.name = 'Analyze Novel'
