import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './cultural-editor.prompt.md'), 'utf-8')

export const CulturalErrorSchema = z.object({
  type: z
    .enum(['Untranslated Idioms', 'Cultural Incongruity', 'Unnatural Collocations'])
    .describe('The type of cultural/idiomatic fidelity error found.'),
  sourceSegment: z
    .string()
    .optional()
    .describe(
      'The specific segment from the source text where the cultural issue occurs (if applicable).'
    ),
  translatedSegment: z
    .string()
    .describe('The corresponding segment in the translated text where the cultural issue occurs.'),
  feedback: z
    .string()
    .describe(
      'Detailed feedback explaining the cultural/idiomatic fidelity issue and how it affects the naturalness for native speakers.'
    )
})

export const CulturalEditorOutputSchema = z.object({
  culturalScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      'A cultural fidelity score from 0 (feels completely alien) to 100 (feels perfectly native).'
    ),
  culturalFeedback: z
    .array(CulturalErrorSchema)
    .describe('An array of specific cultural/idiomatic fidelity errors found. Empty if no errors.')
})

export const culturalEditorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  if (!state.requiredEditors?.includes('Cultural')) {
    return {
      culturalScore: undefined,
      culturalFeedback: undefined
    }
  }

  if (!state.translatedText) {
    return {
      culturalScore: 0,
      culturalFeedback: []
    }
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.4,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(CulturalEditorOutputSchema)

  const staticUserMessage = `
##Target Language##
${state.targetLanguage}

##Style Context##
${JSON.stringify(state.styleContext)}

##Character Manifest##
${JSON.stringify(state.characterManifest)}

##Glossary##
${JSON.stringify(state.glossary)}

##Source Text##
${state.sourceText}`.trim()

  const dynamicUserMessage = `
##Translated Text##
${state.translatedText}`.trim()

  const messages = [
    {
      role: 'system',
      content: systemPrompt,
      cache_control: {
        type: 'ephemeral'
      }
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: staticUserMessage,
          cache_control: {
            type: 'ephemeral'
          }
        },
        {
          type: 'text',
          text: dynamicUserMessage
        }
      ]
    }
  ]

  const result = await model.invoke(messages)

  return {
    culturalScore: result.culturalScore,
    culturalFeedback: result.culturalFeedback
  }
}
