import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { cfg } from '../config'
import {
  ensureParagraphIds,
  getParagraphNumber,
  type Paragraph,
  parseParagraphs
} from '../utils/text-paragraph.utils'
import type { TranslateOverallState } from '../workflows/translate-chapter.workflow'

const systemPrompt = readFileSync(join(__dirname, './scene-analyst.prompt.md'), 'utf-8')

export const SceneSchema = z.object({
  startTag: z.string().describe('The exact [P#] tag of the FIRST paragraph in this scene.'),
  endTag: z.string().describe('The exact [P#] tag of the LAST paragraph in this scene.'),
  location: z.string().describe('The physical setting of the scene.'),
  styleGuide: z
    .string()
    .describe(
      "A dense 3-part directive following the VSF Formula: 1. Vibe (Emotional atmosphere), 2. Syntax (Sentence rhythm/structure), 3. Focus (Sensory or vocabulary priority). Example: 'Claustrophobic panic. Use staccato, fragmented sentences. Focus on auditory hallucinations."
    ),
  activeCast: z
    .array(z.string())
    .describe('List of all characters present. Use their CURRENTLY known alias.'),
  hierarchy: z
    .array(z.string())
    .describe(
      'Social power dynamics strictly for characters in this scene (e.g., "King > Guard", "A = B").'
    ),
  criticalFlags: z
    .array(z.string())
    .describe(
      'Narrative constraints. MUST use format "[P#] TrueName -> NewAlias" for identity reveals. Use standard text for others (e.g., "[P#] Character is drunk").'
    )
})

export const SceneAnalystOutputSchema = z.object({
  scenes: z
    .array(SceneSchema)
    .describe('A sequential list of narrative scenes covering the entire chapter without gaps.')
})

export const sceneAnalystNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  const processedText = ensureParagraphIds(state.sourceText)
  const paragraphs = parseParagraphs(processedText)
  const paragraphMap = new Map<string, Paragraph>()

  for (const para of paragraphs) {
    paragraphMap.set(para.id, para)
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-pro',
    temperature: 0.1,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: cfg.openrouterApiKey
    }
  }).withStructuredOutput(SceneAnalystOutputSchema)

  const userPrompt = `
**Global Context:**
${JSON.stringify(state.globalContext)}

**Character Manifest:**
${JSON.stringify(state.characterManifest)}

**Source Text:**
${processedText}`.trim()

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
      content: userPrompt
    }
  ]

  const result = await model.invoke(messages)

  for (const scene of result.scenes) {
    if (!paragraphMap.has(scene.startTag)) {
      throw new Error(`Invalid startTag: "${scene.startTag}" not found in source text`)
    }
    if (!paragraphMap.has(scene.endTag)) {
      throw new Error(`Invalid endTag: "${scene.endTag}" not found in source text`)
    }

    const startNum = getParagraphNumber(scene.startTag)
    const endNum = getParagraphNumber(scene.endTag)

    if (startNum === null || endNum === null) {
      throw new Error(
        `Invalid paragraph tag format: startTag="${scene.startTag}", endTag="${scene.endTag}"`
      )
    }

    if (startNum > endNum) {
      throw new Error(
        `Invalid scene range: startTag "${scene.startTag}" (P${startNum}) must be <= endTag "${scene.endTag}" (P${endNum})`
      )
    }
  }

  let previousEndNum = 0

  for (const scene of result.scenes) {
    const startNum = getParagraphNumber(scene.startTag)
    const endNum = getParagraphNumber(scene.endTag)

    if (startNum === null || endNum === null) {
      throw new Error(
        `Invalid paragraph tag format: startTag="${scene.startTag}", endTag="${scene.endTag}"`
      )
    }

    if (startNum !== previousEndNum + 1) {
      throw new Error(
        `Non-contiguous scenes: expected scene to start at [P${previousEndNum + 1}], but found [P${startNum}]`
      )
    }

    previousEndNum = endNum
  }

  const lastParagraphNum = paragraphs.length

  if (previousEndNum !== lastParagraphNum) {
    throw new Error(
      `Incomplete scene coverage: last scene ends at [P${previousEndNum}], but text has [P${lastParagraphNum}]`
    )
  }

  return {
    sceneAnalysis: result,
    sourceText: processedText
  }
}
