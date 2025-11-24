import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import { CharacterSchema } from '../shared.types'
import type { AnalyzeOverallState } from '../workflows/analyze-chapter.workflow'

const systemPrompt = readFileSync(join(__dirname, './character-indexer.prompt.md'), 'utf-8')

const CandidateCharacterSchema = CharacterSchema.omit({
  gender: true,
  description: true
}).extend({
  characterId: z.uuid().optional().describe('A unique identifier for the character (e.g., UUID).')
})

export const CandidateCharacterIndexerOutputSchema = z.object({
  characters: z
    .array(CandidateCharacterSchema)
    .describe('An array of all unique character objects present in this chapter.')
})

export const characterIndexerNode = async (
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
  }).withStructuredOutput(CandidateCharacterIndexerOutputSchema)

  const userPrompt = `
##Chapter Text##
${state.chapterText}

##Known Characters##
${JSON.stringify(state.knownCharacters)}`.trim()

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  const newCharacterIds: string[] = []
  const candidateCharacters = result.characters.map((character) => {
    let characterId = character.characterId

    if (!characterId) {
      characterId = randomUUID()
      newCharacterIds.push(characterId)
    }

    return { ...character, characterId }
  })

  return {
    candidateCharacters,
    newCharacterIds
  }
}
