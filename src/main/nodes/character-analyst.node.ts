import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import { CharacterSchema } from '../shared.types'
import type { AnalyzeOverallState } from '../workflows/analyze.workflow'

const systemPrompt = readFileSync(join(__dirname, './character-analyst.prompt.md'), 'utf-8')

export const UpdatedCharacterSchema = CharacterSchema.omit({
  aliases: true,
  titles: true,
  isNamed: true,
  gender: true
}).extend({
  prominenceScore: z
    .int()
    .min(1)
    .max(5)
    .describe(
      "An integer score from 1 to 5 indicating the character's prominence in the chapter: 5 (Protagonist), 4 (Major), 3 (Supporting), 2 (Minor), 1 (Mentioned)."
    )
})

export const CharacterAnalystOutputSchema = z.object({
  updatedCharacters: z
    .array(UpdatedCharacterSchema)
    .describe(
      'An array of updated character objects with gender, prominence score, and description.'
    )
})

export const characterAnalystNode = async (
  state: AnalyzeOverallState,
  _config: RunnableConfig
): Promise<Partial<AnalyzeOverallState>> => {
  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.1,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: cfg.openrouterApiKey
    },
    modelKwargs: {
      reasoning: {
        max_tokens: -1
      }
    }
  }).withStructuredOutput(CharacterAnalystOutputSchema)

  if (!state.candidateCharacters || state.candidateCharacters.length === 0) {
    return {
      updatedCharacters: []
    }
  }

  const userPrompt = `
##Chapter Text##
${state.chapterText}

##Candidate Characters##
${JSON.stringify(state.candidateCharacters)}`.trim()

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  return {
    updatedCharacters: result.updatedCharacters
  }
}
