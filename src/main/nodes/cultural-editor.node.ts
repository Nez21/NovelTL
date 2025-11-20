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
    .enum([
      'Honorific Mismatch',
      'Literal Idiom',
      'Cultural Incongruity',
      'Sanitization',
      'Context Refusal'
    ])
    .describe('Issues related to cultural gaps, social hierarchy, or localization failures.'),
  severity: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe(
      'Severity level: 1 = Minor awkward phrasing, 2 = Moderate cultural mismatch, 3 = Significant localization failure, 4 = High severity (broken social hierarchy), 5 = Critical (offensive taboo or major cultural violation).'
    ),
  confidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      'Confidence in this specific error assessment from 0 (uncertain) to 100 (highly confident). Higher for clear cultural violations (e.g., honorific mismatches); lower when cultural adaptation requires nuanced judgment.'
    ),
  sourceSegment: z
    .string()
    .describe('The specific cultural reference, idiom, or honorific in the source.'),
  translatedSegment: z.string().describe('The failed localization attempt.'),
  feedback: z
    .string()
    .describe(
      'Must include: (1) an explanation of the cultural misalignment, and (2) at least one suggested fix (partial correction, not the entire segment) with a suggested direction.'
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
