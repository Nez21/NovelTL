export interface Paragraph {
  id: string
  content: string
}

export function addParagraphIds(text: string): string {
  if (!text || text.trim().length === 0) {
    return text
  }

  const paragraphs = text.split(/\n|\r\n/).filter((para) => para.trim().length > 0)

  const taggedParagraphs = paragraphs.map((para, index) => {
    const trimmed = para.trim()
    return `[P${index + 1}] ${trimmed}`
  })

  return taggedParagraphs.join('\n')
}

export function removeParagraphIds(text: string): string {
  if (!text || text.trim().length === 0) {
    return text
  }

  if (!hasParagraphIds(text)) {
    return text
  }

  const paragraphs = parseParagraphs(text)

  return paragraphs.map((para) => para.content).join('\n')
}

export function hasParagraphIds(text: string): boolean {
  if (!text) {
    return false
  }

  return /\[P\d+\]/.test(text)
}

export function ensureParagraphIds(text: string): string {
  if (hasParagraphIds(text)) {
    return text
  }
  return addParagraphIds(text)
}

export function extractParagraphIds(text: string): string[] {
  if (!text) {
    return []
  }

  const matches = text.match(/\[P\d+\]/g)

  return matches || []
}

export function getParagraphNumber(tag: string): number {
  const match = tag.match(/\[P(\d+)\]/)

  if (!match) {
    throw new Error(`Invalid paragraph ID format: "${tag}"`)
  }

  return parseInt(match[1], 10)
}

export function parseParagraphs(text: string): Paragraph[] {
  if (!text || text.trim().length === 0) {
    return []
  }

  const paragraphs: Paragraph[] = []
  const paraBlocks = text.split(/\n|\r\n/)
  const seenIds = new Set<string>()

  for (let i = 0; i < paraBlocks.length; i++) {
    const block = paraBlocks[i]
    const trimmed = block.trim()

    if (!trimmed) {
      continue
    }

    const match = trimmed.match(/^(\[P\d+\])\s+(.*)$/s)

    if (!match) {
      throw new Error(
        `Invalid paragraph format at block ${i + 1}: expected format "[P#] content", got "${trimmed.substring(0, 50)}${trimmed.length > 50 ? '...' : ''}"`
      )
    }

    const id = match[1]
    const content = match[2]
    getParagraphNumber(id)

    if (seenIds.has(id)) {
      throw new Error(`Duplicate paragraph ID found: "${id}"`)
    }

    seenIds.add(id)

    paragraphs.push({
      id,
      content
    })
  }

  paragraphs.sort((a, b) => {
    return getParagraphNumber(a.id) - getParagraphNumber(b.id)
  })

  const startParagraphNumber = getParagraphNumber(paragraphs[0].id)

  for (let i = 0; i < paragraphs.length; i++) {
    const expectedNumber = startParagraphNumber + i
    const actualNumber = getParagraphNumber(paragraphs[i].id)

    if (actualNumber !== expectedNumber) {
      throw new Error(
        `Non-sequential paragraph numbering: expected [P${expectedNumber}], found [P${actualNumber}]`
      )
    }
  }

  return paragraphs
}

function _parseParagraphsWithoutSequentialValidation(text: string): Paragraph[] {
  if (!text || text.trim().length === 0) {
    return []
  }

  const paragraphs: Paragraph[] = []
  const paraBlocks = text.split(/\n|\r\n/)
  const seenIds = new Set<string>()

  for (let i = 0; i < paraBlocks.length; i++) {
    const block = paraBlocks[i]
    const trimmed = block.trim()

    if (!trimmed) {
      continue
    }

    const match = trimmed.match(/^(\[P\d+\])\s+(.*)$/s)

    if (!match) {
      throw new Error(
        `Invalid paragraph format at block ${i + 1}: expected format "[P#] content", got "${trimmed.substring(0, 50)}${trimmed.length > 50 ? '...' : ''}"`
      )
    }

    const id = match[1]
    const content = match[2]
    getParagraphNumber(id)

    if (seenIds.has(id)) {
      throw new Error(`Duplicate paragraph ID found: "${id}"`)
    }

    seenIds.add(id)

    paragraphs.push({
      id,
      content
    })
  }

  paragraphs.sort((a, b) => {
    return getParagraphNumber(a.id) - getParagraphNumber(b.id)
  })

  return paragraphs
}

export function mapParagraphs(
  sourceText: string,
  targetText: string
): Array<{ source: Paragraph; target?: Paragraph }> {
  const sourceParagraphs = parseParagraphs(sourceText)
  const targetParagraphs = parseParagraphs(targetText)

  const targetMap = new Map<string, Paragraph>()

  for (const para of targetParagraphs) {
    targetMap.set(para.id, para)
  }

  return sourceParagraphs.map((sourcePara) => ({
    source: sourcePara,
    target: targetMap.get(sourcePara.id)
  }))
}

export function getParagraphById(
  text: string,
  paragraphId: string | number
): Paragraph | undefined {
  const paragraphs = parseParagraphs(text)

  let searchId: string

  if (typeof paragraphId === 'number') {
    searchId = `[P${paragraphId}]`
  } else {
    const numMatch = paragraphId.match(/^(\d+)$/)

    if (numMatch) {
      searchId = `[P${numMatch[1]}]`
    } else {
      searchId = paragraphId
    }
  }

  return paragraphs.find((para) => para.id === searchId)
}

export function getParagraphsInRange(sourceText: string, startTag: string, endTag: string): string {
  const startNum = getParagraphNumber(startTag)
  const endNum = getParagraphNumber(endTag)

  if (startNum > endNum) {
    throw new Error(
      `Invalid range: startTag "${startTag}" (P${startNum}) must be <= endTag "${endTag}" (P${endNum})`
    )
  }

  const allParagraphs = parseParagraphs(sourceText)

  if (startNum < 1 || endNum > allParagraphs.length) {
    throw new Error(
      `Range out of bounds: requested [P${startNum}]-[P${endNum}], but text has [P1]-[P${allParagraphs.length}]`
    )
  }

  const rangeParagraphs = allParagraphs.slice(startNum - 1, endNum)

  if (rangeParagraphs.length !== endNum - startNum + 1) {
    throw new Error(
      `Missing paragraphs in range: expected ${endNum - startNum + 1} paragraphs, found ${rangeParagraphs.length}`
    )
  }

  return rangeParagraphs.map((para) => `${para.id} ${para.content}`).join('\n')
}

export function fixTranslatedText(translatedText: string, sourceText: string): string {
  if (!translatedText || !translatedText.trim()) {
    throw new Error('Translated text is empty')
  }

  const sourceParagraphs = parseParagraphs(sourceText)

  if (sourceParagraphs.length === 0) {
    throw new Error('Source text must contain at least one paragraph with ID')
  }

  const expectedFirstId = sourceParagraphs[0].id

  let fixedText = translatedText
    .replace(/([^\n])(\[P\d+\])/g, '$1\n$2')
    .replace(/(\[P\d+\])([^\s\n])/g, '$1 $2')
    .replace(/(\[P\d+\])\s+/g, '$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const hasAnyParagraphIds = /\[P\d+\]/.test(fixedText)

  const firstParagraphIdMatch = fixedText.match(/\[P\d+\]/)
  if (
    firstParagraphIdMatch &&
    firstParagraphIdMatch.index !== undefined &&
    firstParagraphIdMatch.index > 0
  ) {
    const firstLine = fixedText.substring(0, firstParagraphIdMatch.index).trim()

    if (firstLine.match(/^\[P\d+\]/)) {
      fixedText = fixedText.substring(firstParagraphIdMatch.index).trim()
    }
  }

  const lines = fixedText.split(/\n|\r\n/)
  const lineData: Array<{
    id?: string
    idNumber?: number
    hasId: boolean
    trimmed: string
    content: string
  }> = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) continue

    const match = trimmed.match(/^(\[P\d+\])\s*(.*)$/s)

    if (match) {
      const id = match[1]
      const idNumber = getParagraphNumber(id)
      lineData.push({
        trimmed,
        hasId: true,
        id,
        idNumber,
        content: match[2].trim()
      })
    } else {
      lineData.push({
        hasId: false,
        trimmed,
        content: trimmed
      })
    }
  }

  if (lineData.length === 0) {
    throw new Error('Translated text is empty after processing')
  }

  const nextIdMap = new Map<number, { id: string; idNumber: number } | undefined>()
  let lastIdInfo: { id: string; idNumber: number } | undefined

  for (let i = lineData.length - 1; i >= 0; i--) {
    if (lineData[i].hasId) {
      lastIdInfo = {
        id: lineData[i].id!,
        idNumber: lineData[i].idNumber!
      }
    }
    nextIdMap.set(i, lastIdInfo)
  }

  const normalizedLines: string[] = []
  let pendingFirstLine: string | undefined
  let lastProcessedIdNumber: number | undefined

  for (let i = 0; i < lineData.length; i++) {
    const data = lineData[i]

    if (data.hasId) {
      if (pendingFirstLine && data.id === expectedFirstId) {
        const isLikelyPreamble = pendingFirstLine?.length < 50 && !pendingFirstLine?.includes('.')

        if (isLikelyPreamble) {
          normalizedLines.push(`${data.id} ${data.content}`)
        } else {
          normalizedLines.push(`${data.id} ${pendingFirstLine} ${data.content}`)
        }

        pendingFirstLine = undefined
      } else {
        normalizedLines.push(`${data.id} ${data.content}`)
      }
      lastProcessedIdNumber = data.idNumber
    } else {
      if (normalizedLines.length > 0) {
        const nextIdInfo = nextIdMap.get(i + 1)

        if (nextIdInfo && lastProcessedIdNumber) {
          const expectedNextIdNumber = lastProcessedIdNumber + 1
          const expectedNextId = `[P${expectedNextIdNumber}]`

          if (nextIdInfo.idNumber === expectedNextIdNumber) {
            const lastLine = normalizedLines[normalizedLines.length - 1]
            normalizedLines[normalizedLines.length - 1] = `${lastLine} ${data.content}`
          } else if (nextIdInfo.idNumber > expectedNextIdNumber) {
            normalizedLines.push(`${expectedNextId} ${data.content}`)
            lastProcessedIdNumber = expectedNextIdNumber
          } else {
            const lastLine = normalizedLines[normalizedLines.length - 1]
            normalizedLines[normalizedLines.length - 1] = `${lastLine} ${data.content}`
          }
        } else {
          const lastLine = normalizedLines[normalizedLines.length - 1]
          normalizedLines[normalizedLines.length - 1] = `${lastLine} ${data.content}`
        }
      } else {
        if (hasAnyParagraphIds) {
          pendingFirstLine = data.content
        } else {
          throw new Error(
            `Invalid format: first line must start with a paragraph ID, got "${data.content.substring(0, 50)}${data.content.length > 50 ? '...' : ''}"`
          )
        }
      }
    }
  }

  if (pendingFirstLine) {
    normalizedLines.unshift(`${expectedFirstId} ${pendingFirstLine}`)
  }

  fixedText = normalizedLines.join('\n')

  mapParagraphs(sourceText, fixedText)

  return fixedText
}
