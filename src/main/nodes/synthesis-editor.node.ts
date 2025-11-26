import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import { cfg } from '../config'
import { fixAnnotatedText, removeParagraphIds } from '../utils/text-paragraph.utils'
import type { TranslateOverallState } from '../workflows/translate-chapter.workflow'

const systemPrompt = readFileSync(join(__dirname, './synthesis-editor.prompt.md'), 'utf-8')

export const synthesisEditorNode = async (
  state: TranslateOverallState,
  _config: RunnableConfig
): Promise<Partial<TranslateOverallState>> => {
  if (!state.translatedText) {
    throw new Error('Translated text is required for synthesis editing')
  }

  if (!state.sourceText) {
    throw new Error('Source text is required for synthesis editing')
  }

  if (!state.sceneAnalysis?.scenes || state.sceneAnalysis.scenes.length === 0) {
    throw new Error('Scene analysis is required for synthesis editing')
  }

  if (
    !state.accuracyFeedback?.length &&
    !state.styleFeedback?.length &&
    !state.readabilityFeedback?.length
  ) {
    return {
      translatedText: removeParagraphIds(state.translatedText || ''),
      editCount: 999
    }
  }

  const model = new ChatOpenAI({
    model: 'google/gemini-2.5-flash',
    temperature: 0.1,
    configuration: { baseURL: 'https://openrouter.ai/api/v1', apiKey: cfg.openrouterApiKey },
    modelKwargs: { reasoning: { max_tokens: 2048, exclude: true } }
  })

  const userPrompt = `
##Target Language##
${state.targetLanguage}

##Global Context##
${JSON.stringify(state.globalContext)}

##Glossary##
${JSON.stringify(state.glossary)} 

##Scene Contexts##
${JSON.stringify(state.sceneAnalysis.scenes)}

##Source Text##
${state.sourceText}

##Draft Text##
${state.translatedText}

##Critique Reports##
${JSON.stringify({
  accuracyReport: state.accuracyFeedback,
  styleReport: state.styleFeedback,
  readabilityReport: state.readabilityFeedback
})}`.trim()

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
  const revisedText =
    typeof result.content === 'string'
      ? result.content
      : result.content.map((block) => block.text).join('\n')
  const editCount = (state.editCount || 0) + 1

  return {
    translatedText:
      editCount < 2
        ? fixAnnotatedText(revisedText)
        : removeParagraphIds(fixAnnotatedText(revisedText)),
    editCount,
    accuracyFeedback: [],
    styleFeedback: [],
    readabilityFeedback: []
  }
}
