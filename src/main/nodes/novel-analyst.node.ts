import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { GlobalContextOverallState } from '../workflows/analyze-novel.workflow'

const systemPrompt = readFileSync(join(__dirname, './novel-analyst.prompt.md'), 'utf-8')

export const WorldLawsSchema = z.object({
  genreFramework: z
    .string()
    .describe(
      'The specific genre framework (e.g., "Eastern Fantasy / Xianxia", "High Fantasy", "Cyberpunk")'
    ),
  temporalSetting: z
    .string()
    .describe(
      'The technology/culture level (e.g., "Pre-Industrial / Ancient China", "Modern Day")'
    ),
  magicLogic: z
    .string()
    .describe(
      'The magic system type (e.g., "Hard Magic: Cultivation Ranks are rigid", "Soft Magic: Vague, wondrous")'
    )
})

export const NarrativeVoiceSchema = z.object({
  perspectivePolicy: z
    .string()
    .describe('The narrative perspective (e.g., "Third-Person Limited", "Omniscient")'),
  translationPhilosophy: z
    .string()
    .describe(
      'The translation approach (e.g., "Foreignizing: Keep Pinyin terms for cultivation concepts", "Localizing: Translate terms to target language equivalents")'
    )
})

export const VocabularyConstraintsSchema = z.object({
  bannedCategories: z
    .array(z.string())
    .describe(
      "Categories of words that would break immersion (e.g., \"Modern Slang: 'Cool', 'Dude', 'Okay'\", \"Scientific Units: 'Meters', 'Seconds' - use 'Zhang', 'Breaths'\")"
    )
})

export const GlobalContextSchema = z.object({
  worldLaws: WorldLawsSchema,
  narrativeVoice: NarrativeVoiceSchema,
  vocabularyConstraints: VocabularyConstraintsSchema
})

export const novelAnalystNode = async (
  state: GlobalContextOverallState,
  _config: RunnableConfig
): Promise<Partial<GlobalContextOverallState>> => {
  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-pro',
    temperature: 0.1,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: cfg.openrouterApiKey
    }
  }).withStructuredOutput(GlobalContextSchema)

  const userPrompt = `
##Text Sample##
${state.textSample}`.trim()

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

  const result = await model.invoke(messages)

  return {
    globalContext: result
  }
}
