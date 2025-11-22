import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import pLimit from 'p-limit'
import { z } from 'zod'
import { cfg } from '../config'
import { CONCURRENT_LIMIT } from '../constant'
import { getParagraphsInRange } from '../utils/text-paragraph.utils'
import type { TranslateOverallState } from '../workflows/translate.workflow'

const systemPrompt = readFileSync(join(__dirname, './draft-selector.prompt.md'), 'utf-8')

export const DraftSelectorOutputSchema = z.object({
  selectedIndex: z
    .number()
    .int()
    .min(0)
    .describe('The 0-based index of the selected draft candidate.'),
  rationale: z
    .string()
    .describe('A brief explanation of why this draft was selected over the others.')
})

export const draftSelectorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  if (!state.sceneDrafts || state.sceneDrafts.length === 0) {
    throw new Error('Scene drafts are required for selection')
  }

  if (!state.sceneAnalysis?.scenes || state.sceneAnalysis.scenes.length === 0) {
    throw new Error('Scene analysis is required for selection')
  }

  if (!state.sourceText) {
    throw new Error('Source text is required')
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.1,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: -1 } }
  }).withStructuredOutput(DraftSelectorOutputSchema)

  const limit = pLimit(CONCURRENT_LIMIT)

  const sceneSelectionPromises = state.sceneAnalysis.scenes.map((scene, sceneIndex) => {
    return limit(async () => {
      const sceneDraftCandidates = state.sceneDrafts?.[sceneIndex]

      if (!sceneDraftCandidates || sceneDraftCandidates.length === 0) {
        throw new Error(`No draft candidates found for scene ${sceneIndex + 1}`)
      }

      const sourceSegment = getParagraphsInRange(state.sourceText, scene.startTag, scene.endTag)

      const userPrompt = `
##Target Language##
${state.targetLanguage}

##Source Text##
${sourceSegment}

##Scene Context##
${JSON.stringify(scene)}

##Glossary##
${JSON.stringify(state.glossary)}

##Draft Candidates##
${JSON.stringify(sceneDraftCandidates)}`.trim()

      const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]

      const result = await model.invoke(messages)

      const selectedIndex = Math.max(
        0,
        Math.min(result.selectedIndex, sceneDraftCandidates.length - 1)
      )
      const selectedDraft = sceneDraftCandidates[selectedIndex]

      if (!selectedDraft) {
        throw new Error(
          `Invalid selection index ${selectedIndex} for scene ${sceneIndex + 1}. Available indices: 0-${sceneDraftCandidates.length - 1}`
        )
      }

      return {
        selectedDraft,
        rationale: `Scene ${sceneIndex + 1} (${scene.startTag}-${scene.endTag}): ${result.rationale}`
      }
    })
  })

  const sceneSelections = await Promise.all(sceneSelectionPromises)

  const translatedText = sceneSelections.map((s) => s.selectedDraft).join('\n')
  const selectionRationales = sceneSelections.map((s) => s.rationale)

  return {
    translatedText,
    draftSelectionRationale: selectionRationales.join('\n\n')
  }
}
