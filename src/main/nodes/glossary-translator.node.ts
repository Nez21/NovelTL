import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import { GenderEnum, TermCategoryEnum } from '../shared.types'
import type { AnalyzeOverallState } from '../workflows/analyze.workflow'

const systemPrompt = readFileSync(join(__dirname, './glossary-translator.prompt.md'), 'utf-8')

export const TranslationEntityInputSchema = z.object({
  term: z.string().describe('The source term to be translated.'),
  category: TermCategoryEnum.describe('The category of the term.'),
  gender: GenderEnum.optional().describe('Optional gender information.'),
  description: z.string().optional().describe('Optional specific instructions for translation.')
})

export const TranslatedEntitySchema = z.object({
  term: z.string().describe('The original source term.'),
  category: TermCategoryEnum.describe('The category of the term.'),
  translation: z.string().describe('The translated term in the target language.')
})

export const GlossaryTranslatorOutputSchema = z.object({
  translatedEntities: z
    .array(TranslatedEntitySchema)
    .describe('An array of translated entities with source terms and their translations.')
})

export const glossaryTranslatorNode = async (
  state: AnalyzeOverallState,
  _config: RunnableConfig
): Promise<Partial<AnalyzeOverallState>> => {
  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.1,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: cfg.openrouterApiKey
    }
  }).withStructuredOutput(GlossaryTranslatorOutputSchema)

  const entities: z.infer<typeof TranslationEntityInputSchema>[] = []

  if (state.updatedCharacters) {
    for (const character of state.updatedCharacters) {
      if (
        !state.newCharacterIds?.includes(character.characterId) &&
        state.knownCharacters.find((c) => c.characterId === character.characterId)
          ?.canonicalName === character.canonicalName
      ) {
        continue
      }

      const otherCharacterInfo = state.candidateCharacters?.find(
        (c) => c.characterId === character.characterId
      )

      if (!otherCharacterInfo) {
        throw new Error(`Character ${character.characterId} not found in candidate characters`)
      }

      if (!otherCharacterInfo.isNamed || character.prominenceScore < 3) {
        continue
      }

      entities.push({
        term: character.canonicalName,
        category: 'Proper Nouns (Person)'
      })
    }
  }

  if (state.newTerms) {
    for (const term of state.newTerms) {
      entities.push({
        term: term.term,
        category: term.category,
        description: term.description
      })
    }
  }

  if (entities.length === 0) {
    return {
      translatedEntities: []
    }
  }

  const userPrompt = `
##Target Language##
${state.targetLanguage}

##Entities##
${JSON.stringify(entities)}`.trim()

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  return {
    translatedEntities: result.translatedEntities
  }
}
