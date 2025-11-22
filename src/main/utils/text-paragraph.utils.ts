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

  return /\[P[\d,]+\]/.test(text)
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

  const matches = text.match(/\[P[\d,]+\]/g)

  return matches || []
}

export function getParagraphNumber(tag: string): number {
  const match = tag.match(/\[P(\d+)\]/)

  if (!match) {
    throw new Error(`Invalid paragraph ID format: "${tag}"`)
  }

  return parseInt(match[1], 10)
}

function getParagraphNumbersFromMerged(tag: string): number[] {
  const mergedMatch = tag.match(/\[P([\d,]+)\]/)

  if (!mergedMatch) {
    throw new Error(`Invalid paragraph ID format: "${tag}"`)
  }

  const numbersStr = mergedMatch[1]

  if (numbersStr.includes(',')) {
    return numbersStr.split(',').map((num) => parseInt(num.trim(), 10))
  }

  return [parseInt(numbersStr, 10)]
}

function isMergedParagraphId(tag: string): boolean {
  return /\[P\d+,\d+/.test(tag)
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

    const match = trimmed.match(/^(\[P[\d,]+\])\s+(.*)$/s)

    if (!match) {
      throw new Error(
        `Invalid paragraph format at block ${i + 1}: expected format "[P#] content" or "[P#,#] content", got "${trimmed.substring(0, 50)}${trimmed.length > 50 ? '...' : ''}"`
      )
    }

    const id = match[1]
    const content = match[2]

    if (isMergedParagraphId(id)) {
      getParagraphNumbersFromMerged(id)
    } else {
      getParagraphNumber(id)
    }

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
    const aNumArr = isMergedParagraphId(a.id)
      ? getParagraphNumbersFromMerged(a.id)
      : [getParagraphNumber(a.id)]
    const bNumArr = isMergedParagraphId(b.id)
      ? getParagraphNumbersFromMerged(b.id)
      : [getParagraphNumber(b.id)]
    return aNumArr[0] - bNumArr[0]
  })

  const firstNumArr = isMergedParagraphId(paragraphs[0].id)
    ? getParagraphNumbersFromMerged(paragraphs[0].id)
    : [getParagraphNumber(paragraphs[0].id)]
  const startParagraphNumber = firstNumArr[0]

  let expectedNumber = startParagraphNumber

  for (let i = 0; i < paragraphs.length; i++) {
    const paraNumArr = isMergedParagraphId(paragraphs[i].id)
      ? getParagraphNumbersFromMerged(paragraphs[i].id)
      : [getParagraphNumber(paragraphs[i].id)]

    if (paraNumArr[0] !== expectedNumber) {
      throw new Error(
        `Non-sequential paragraph numbering: expected [P${expectedNumber}], found ${paragraphs[i].id}`
      )
    }

    expectedNumber = paraNumArr[paraNumArr.length - 1] + 1
  }

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
    if (isMergedParagraphId(para.id)) {
      const numArr = getParagraphNumbersFromMerged(para.id)
      for (const num of numArr) {
        targetMap.set(`[P${num}]`, para)
      }
    }
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

  const directMatch = paragraphs.find((para) => para.id === searchId)
  if (directMatch) {
    return directMatch
  }

  const searchNum = typeof paragraphId === 'number' ? paragraphId : getParagraphNumber(searchId)

  return paragraphs.find((para) => {
    if (isMergedParagraphId(para.id)) {
      const numArr = getParagraphNumbersFromMerged(para.id)
      return numArr.includes(searchNum)
    }
    return false
  })
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

  if (allParagraphs.length === 0) {
    throw new Error('Source text has no paragraphs')
  }

  const firstParagraphNumArr = isMergedParagraphId(allParagraphs[0].id)
    ? getParagraphNumbersFromMerged(allParagraphs[0].id)
    : [getParagraphNumber(allParagraphs[0].id)]
  const lastParagraphNumArr = isMergedParagraphId(allParagraphs[allParagraphs.length - 1].id)
    ? getParagraphNumbersFromMerged(allParagraphs[allParagraphs.length - 1].id)
    : [getParagraphNumber(allParagraphs[allParagraphs.length - 1].id)]

  const minParagraphNum = firstParagraphNumArr[0]
  const maxParagraphNum = lastParagraphNumArr[lastParagraphNumArr.length - 1]

  if (startNum < minParagraphNum || endNum > maxParagraphNum) {
    throw new Error(
      `Range out of bounds: requested [P${startNum}]-[P${endNum}], but text has [P${minParagraphNum}]-[P${maxParagraphNum}]`
    )
  }

  const rangeParagraphs: Paragraph[] = []

  for (const paragraph of allParagraphs) {
    const paragraphNumArr = isMergedParagraphId(paragraph.id)
      ? getParagraphNumbersFromMerged(paragraph.id)
      : [getParagraphNumber(paragraph.id)]

    const paragraphStart = paragraphNumArr[0]
    const paragraphEnd = paragraphNumArr[paragraphNumArr.length - 1]

    if (paragraphStart >= startNum && paragraphStart <= endNum) {
      rangeParagraphs.push(paragraph)
    } else if (paragraphEnd >= startNum && paragraphEnd <= endNum) {
      rangeParagraphs.push(paragraph)
    } else if (paragraphStart <= startNum && paragraphEnd >= endNum) {
      rangeParagraphs.push(paragraph)
    }
  }

  if (rangeParagraphs.length === 0) {
    throw new Error(
      `Missing paragraphs in range: expected paragraphs in [P${startNum}]-[P${endNum}], found none`
    )
  }

  return rangeParagraphs.map((paragraph) => `${paragraph.id} ${paragraph.content}`).join('\n')
}

export function fixAnnotatedText(translatedText: string): string {
  if (!translatedText || !translatedText.trim()) {
    return ''
  }

  let fixedText = translatedText

  fixedText = fixedText.replace(/\[(\d+)\]/g, '[P$1]')
  fixedText = fixedText.replace(/([^\n])(\[P\d+\])/g, '$1\n$2')
  fixedText = fixedText.replace(/(\[P\d+\])([^\s\n])/g, '$1 $2')
  fixedText = fixedText.replace(/(\[P\d+\])\s+/g, '$1 ')
  fixedText = fixedText.replace(/\n{3,}/g, '\n\n')

  const firstParaIdMatch = fixedText.match(/\[P\d+\]/)
  if (firstParaIdMatch && firstParaIdMatch.index !== undefined && firstParaIdMatch.index > 0) {
    fixedText = fixedText.substring(firstParaIdMatch.index).trim()
  }

  const lines = fixedText.split(/\n|\r\n/)
  const parsedLines: Array<{ id: number | null; content: string }> = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    const paragraphIdMatch = trimmed.match(/^(\[P\d+\])\s*(.*)$/s)

    if (paragraphIdMatch) {
      const id = getParagraphNumber(paragraphIdMatch[1])
      const content = paragraphIdMatch[2].trim()
      parsedLines.push({ id, content })
    } else {
      if (parsedLines.length > 0) {
        parsedLines[parsedLines.length - 1].content += ` ${trimmed}`
      } else {
        parsedLines.push({ id: null, content: trimmed })
      }
    }
  }

  if (parsedLines.length === 0) {
    return translatedText.trim()
  }

  const normalizedLines: string[] = []
  let i = 0

  while (i < parsedLines.length) {
    const current = parsedLines[i]

    if (current.id === null) {
      if (normalizedLines.length > 0) {
        const lastLine = normalizedLines[normalizedLines.length - 1]
        normalizedLines[normalizedLines.length - 1] = `${lastLine} ${current.content}`
      } else {
        normalizedLines.push(current.content)
      }
      i++
      continue
    }

    const mergedIds: number[] = [current.id]
    let mergedContent = current.content
    let j = i + 1

    while (j < parsedLines.length && parsedLines[j].id === null) {
      mergedContent += ` ${parsedLines[j].content}`
      j++
    }

    if (j < parsedLines.length) {
      const nextId = parsedLines[j].id
      if (nextId !== null) {
        const expectedNextId = current.id + 1
        if (nextId > expectedNextId) {
          for (let k = expectedNextId; k < nextId; k++) {
            mergedIds.push(k)
          }
        }
      }
    }

    if (mergedIds.length > 1) {
      const mergedIdStr = `[P${mergedIds.join(',')}]`
      normalizedLines.push(`${mergedIdStr} ${mergedContent}`)
    } else {
      normalizedLines.push(`[P${current.id}] ${mergedContent}`)
    }

    i = j
  }

  return normalizedLines.join('\n').trim()
}
