import { describe, expect, it } from 'vitest'
import {
  addParagraphIds,
  ensureParagraphIds,
  extractParagraphIds,
  fixAnnotatedText,
  getParagraphById,
  getParagraphNumber,
  getParagraphsInRange,
  hasParagraphIds,
  mapParagraphs,
  parseParagraphs,
  removeParagraphIds
} from './text-paragraph.utils'

describe('addParagraphIds', () => {
  it('should add paragraph IDs to text without IDs', () => {
    const text = 'First paragraph.\nSecond paragraph.\nThird paragraph.'
    const result = addParagraphIds(text)
    expect(result).toBe('[P1] First paragraph.\n[P2] Second paragraph.\n[P3] Third paragraph.')
  })

  it('should handle single paragraph', () => {
    const text = 'Single paragraph.'
    const result = addParagraphIds(text)
    expect(result).toBe('[P1] Single paragraph.')
  })

  it('should handle empty text', () => {
    expect(addParagraphIds('')).toBe('')
    expect(addParagraphIds('   ')).toBe('   ')
  })

  it('should handle multiple newlines', () => {
    const text = 'First\n\n\nSecond'
    const result = addParagraphIds(text)
    expect(result).toContain('[P1]')
    expect(result).toContain('[P2]')
  })

  it('should treat each line as a separate paragraph', () => {
    const text = 'Line 1\nLine 2\nLine 3\nLine 4'
    const result = addParagraphIds(text)
    expect(result).toBe('[P1] Line 1\n[P2] Line 2\n[P3] Line 3\n[P4] Line 4')
  })
})

describe('removeParagraphIds', () => {
  it('should remove paragraph IDs from text', () => {
    const text = '[P1] First paragraph.\n[P2] Second paragraph.\n[P3] Third paragraph.'
    const result = removeParagraphIds(text)
    expect(result).toBe('First paragraph.\nSecond paragraph.\nThird paragraph.')
  })

  it('should handle text without paragraph IDs', () => {
    const text = 'First paragraph.\nSecond paragraph.'
    const result = removeParagraphIds(text)
    expect(result).toBe(text)
  })

  it('should handle empty text', () => {
    expect(removeParagraphIds('')).toBe('')
  })

  it('should remove IDs with various spacing', () => {
    const text = '[P1]   Content\n[P2]\tContent'
    const result = removeParagraphIds(text)
    expect(result).toBe('Content\nContent')
  })
})

describe('hasParagraphIds', () => {
  it('should return true for text with paragraph IDs', () => {
    expect(hasParagraphIds('[P1] Content')).toBe(true)
    expect(hasParagraphIds('Text [P1] content')).toBe(true)
  })

  it('should return false for text without paragraph IDs', () => {
    expect(hasParagraphIds('Just text')).toBe(false)
    expect(hasParagraphIds('')).toBe(false)
  })

  it('should handle null/undefined', () => {
    expect(hasParagraphIds('')).toBe(false)
  })

  it('should return true for merged paragraph IDs', () => {
    expect(hasParagraphIds('[P1,2] Merged content')).toBe(true)
  })
})

describe('ensureParagraphIds', () => {
  it('should return text as-is if it already has paragraph IDs', () => {
    const text = '[P1] Content'
    expect(ensureParagraphIds(text)).toBe(text)
  })

  it('should add paragraph IDs if text does not have them', () => {
    const text = 'First\n\nSecond'
    const result = ensureParagraphIds(text)
    expect(result).toContain('[P1]')
    expect(result).toContain('[P2]')
  })
})

describe('extractParagraphIds', () => {
  it('should extract all paragraph IDs from text', () => {
    const text = '[P1] First\n\n[P2] Second\n\n[P3] Third'
    const result = extractParagraphIds(text)
    expect(result).toEqual(['[P1]', '[P2]', '[P3]'])
  })

  it('should return empty array for text without paragraph IDs', () => {
    expect(extractParagraphIds('No IDs here')).toEqual([])
    expect(extractParagraphIds('')).toEqual([])
  })

  it('should extract IDs in order', () => {
    const text = '[P5] Content\n\n[P1] Content\n\n[P3] Content'
    const result = extractParagraphIds(text)
    expect(result).toEqual(['[P5]', '[P1]', '[P3]'])
  })
})

describe('getParagraphNumber', () => {
  it('should extract number from valid paragraph ID', () => {
    expect(getParagraphNumber('[P1]')).toBe(1)
    expect(getParagraphNumber('[P42]')).toBe(42)
    expect(getParagraphNumber('[P999]')).toBe(999)
  })

  it('should throw error for invalid format', () => {
    expect(() => getParagraphNumber('P1')).toThrow('Invalid paragraph ID format: "P1"')
    expect(() => getParagraphNumber('[P]')).toThrow('Invalid paragraph ID format: "[P]"')
    expect(() => getParagraphNumber('invalid')).toThrow('Invalid paragraph ID format: "invalid"')
    expect(() => getParagraphNumber('')).toThrow('Invalid paragraph ID format: ""')
  })
})

describe('parseParagraphs', () => {
  it('should parse merged paragraph IDs', () => {
    const text = '[P1,2] Merged content\n[P3] Third'
    const result = parseParagraphs(text)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('[P1,2]')
    expect(result[0].content).toBe('Merged content')
    expect(result[1].id).toBe('[P3]')
    expect(result[1].content).toBe('Third')
  })

  it('should validate sequential numbering with merged paragraphs', () => {
    const text = '[P1,2] Merged\n[P3] Third'
    const result = parseParagraphs(text)
    expect(result).toHaveLength(2)
  })

  it('should throw error for non-sequential merged paragraphs', () => {
    const text = '[P1,2] Merged\n[P4] Fourth'
    expect(() => parseParagraphs(text)).toThrow('Non-sequential paragraph numbering')
  })
  it('should parse valid paragraphs with sequential IDs', () => {
    const text = '[P1] First paragraph.\n[P2] Second paragraph.\n[P3] Third paragraph.'
    const result = parseParagraphs(text)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ id: '[P1]', content: 'First paragraph.' })
    expect(result[1]).toEqual({ id: '[P2]', content: 'Second paragraph.' })
    expect(result[2]).toEqual({ id: '[P3]', content: 'Third paragraph.' })
  })

  it('should return empty array for empty text', () => {
    expect(parseParagraphs('')).toEqual([])
    expect(parseParagraphs('   ')).toEqual([])
  })

  it('should throw error for invalid format', () => {
    const text = 'Invalid paragraph without ID'
    expect(() => parseParagraphs(text)).toThrow('Invalid paragraph format')
  })

  it('should throw error for missing space after ID', () => {
    const text = '[P1]Content'
    expect(() => parseParagraphs(text)).toThrow('Invalid paragraph format')
  })

  it('should throw error for duplicate IDs', () => {
    const text = '[P1] First\n\n[P1] Duplicate'
    expect(() => parseParagraphs(text)).toThrow('Duplicate paragraph ID found: "[P1]"')
  })

  it('should throw error for non-sequential numbering', () => {
    const text = '[P1] First\n\n[P3] Third'
    expect(() => parseParagraphs(text)).toThrow('Non-sequential paragraph numbering')
  })

  it('should sort and validate out-of-order paragraphs', () => {
    const text = '[P2] Second\n\n[P1] First'
    const result = parseParagraphs(text)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('[P1]')
    expect(result[1].id).toBe('[P2]')
  })

  it('should handle each line as a separate paragraph', () => {
    const text = '[P1] Line 1\n[P2] Line 2\n[P3] Line 3\n[P4] Another paragraph'
    const result = parseParagraphs(text)

    expect(result).toHaveLength(4)
    expect(result[0].content).toBe('Line 1')
    expect(result[1].content).toBe('Line 2')
    expect(result[2].content).toBe('Line 3')
    expect(result[3].content).toBe('Another paragraph')
  })

  it('should skip empty blocks', () => {
    const text = '[P1] First\n\n[P2] Second'
    const result = parseParagraphs(text)
    expect(result).toHaveLength(2)
  })
})

describe('mapParagraphs', () => {
  it('should map paragraphs between source and target texts', () => {
    const source = '[P1] Hello\n[P2] World'
    const target = '[P1] Xin chào\n[P2] Thế giới'
    const result = mapParagraphs(source, target)

    expect(result).toHaveLength(2)
    expect(result[0].source.content).toBe('Hello')
    expect(result[0].target?.content).toBe('Xin chào')
    expect(result[1].source.content).toBe('World')
    expect(result[1].target?.content).toBe('Thế giới')
  })

  it('should return undefined for missing target paragraphs', () => {
    const source = '[P1] First\n[P2] Second\n[P3] Third'
    const target = '[P1] Đầu tiên\n[P2] Thứ hai\n[P3] Thứ ba'
    const result = mapParagraphs(source, target)

    expect(result).toHaveLength(3)
    expect(result[0].target).not.toBeUndefined()
    expect(result[1].target).not.toBeUndefined()
    expect(result[2].target).not.toBeUndefined()

    const source2 = '[P1] First\n[P2] Second\n[P3] Third'
    const target2 = '[P1] Đầu tiên\n[P3] Thứ ba'
    expect(() => mapParagraphs(source2, target2)).toThrow('Non-sequential paragraph numbering')
  })

  it('should handle empty source text', () => {
    const result = mapParagraphs('', '[P1] Content')
    expect(result).toEqual([])
  })

  it('should handle empty target text', () => {
    const source = '[P1] Content'
    const result = mapParagraphs(source, '')
    expect(result).toHaveLength(1)
    expect(result[0].target).toBeUndefined()
  })

  it('should map source paragraphs to merged target paragraphs', () => {
    const source = '[P1] First\n[P2] Second\n[P3] Third'
    const target = '[P1,2] First Second\n[P3] Third'
    const result = mapParagraphs(source, target)

    expect(result).toHaveLength(3)
    expect(result[0].source.id).toBe('[P1]')
    expect(result[0].target?.id).toBe('[P1,2]')
    expect(result[1].source.id).toBe('[P2]')
    expect(result[1].target?.id).toBe('[P1,2]')
    expect(result[2].source.id).toBe('[P3]')
    expect(result[2].target?.id).toBe('[P3]')
  })
})

describe('getParagraphById', () => {
  it('should find paragraph by string ID', () => {
    const text = '[P1] First\n[P2] Second\n[P3] Third'
    const result = getParagraphById(text, '[P2]')

    expect(result).not.toBeUndefined()
    expect(result?.id).toBe('[P2]')
    expect(result?.content).toBe('Second')
  })

  it('should find paragraph by number', () => {
    const text = '[P1] First\n[P2] Second'
    const result = getParagraphById(text, 2)

    expect(result).not.toBeUndefined()
    expect(result?.id).toBe('[P2]')
  })

  it('should find paragraph by number string', () => {
    const text = '[P1] First\n[P2] Second'
    const result = getParagraphById(text, '1')

    expect(result).not.toBeUndefined()
    expect(result?.id).toBe('[P1]')
  })

  it('should return undefined for non-existent paragraph', () => {
    const text = '[P1] First\n[P2] Second'
    expect(getParagraphById(text, '[P99]')).toBeUndefined()
    expect(getParagraphById(text, 99)).toBeUndefined()
  })

  it('should return undefined for empty text', () => {
    expect(getParagraphById('', '[P1]')).toBeUndefined()
  })

  it('should find paragraph in merged format', () => {
    const text = '[P1,2] Merged content\n[P3] Third'
    const result = getParagraphById(text, '[P1]')
    expect(result).toBeDefined()
    expect(result?.id).toBe('[P1,2]')
    expect(result?.content).toBe('Merged content')

    const result2 = getParagraphById(text, '[P2]')
    expect(result2).toBeDefined()
    expect(result2?.id).toBe('[P1,2]')
  })
})

describe('getParagraphsInRange', () => {
  const sampleText =
    '[P1] First paragraph.\n[P2] Second paragraph.\n[P3] Third paragraph.\n[P4] Fourth paragraph.\n[P5] Fifth paragraph.'

  it('should extract a range of paragraphs', () => {
    const result = getParagraphsInRange(sampleText, '[P2]', '[P4]')
    expect(result).toBe('[P2] Second paragraph.\n[P3] Third paragraph.\n[P4] Fourth paragraph.')
  })

  it('should handle merged paragraphs in range', () => {
    const textWithMerged = '[P1] First\n[P2,3] Merged second and third\n[P4] Fourth'
    const result = getParagraphsInRange(textWithMerged, '[P2]', '[P3]')
    expect(result).toContain('[P2,3]')
  })

  it('should throw error when startNum > endNum', () => {
    expect(() => getParagraphsInRange(sampleText, '[P3]', '[P2]')).toThrow(
      'Invalid range: startTag "[P3]" (P3) must be <= endTag "[P2]" (P2)'
    )
  })

  it('should throw error when startNum is out of bounds (less than 1)', () => {
    expect(() => getParagraphsInRange(sampleText, '[P0]', '[P2]')).toThrow('Range out of bounds')
  })

  it('should throw error when endNum is out of bounds (greater than total)', () => {
    expect(() => getParagraphsInRange(sampleText, '[P1]', '[P10]')).toThrow(
      'Range out of bounds: requested [P1]-[P10], but text has [P1]-[P5]'
    )
  })

  it('should throw error when startNum is out of bounds (greater than total)', () => {
    expect(() => getParagraphsInRange(sampleText, '[P10]', '[P15]')).toThrow('Range out of bounds')
  })

  it('should handle merged paragraphs in range', () => {
    const textWithMerged = '[P1] First\n[P2,3] Merged second and third\n[P4] Fourth'
    const result = getParagraphsInRange(textWithMerged, '[P2]', '[P3]')
    expect(result).toContain('[P2,3]')
  })
})

describe('fixAnnotatedText', () => {
  it('should return valid text without fixing', () => {
    const translatedText = '[P2] First paragraph.\n[P3] Second paragraph.\n[P4] Third paragraph.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toBe(translatedText)
    expect(result).toContain('\n')
    expect(result.split('\n').length).toBe(3)
  })

  it('should fix missing newline before paragraph ID', () => {
    const translatedText =
      'Some text[P2] First paragraph.\n[P3] Second paragraph.\n[P4] Third paragraph.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toMatch(/^\[P2\]/)
    expect(result).toContain('[P3]')
    expect(result).toContain('[P4]')
    expect(result).not.toContain('Some text')
  })

  it('should fix missing space after paragraph ID', () => {
    const translatedText = '[P2]First paragraph.\n[P3]Second paragraph.\n[P4]Third paragraph.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toContain('[P2] First')
    expect(result).toContain('[P3] Second')
    expect(result).toContain('[P4] Third')
  })

  it('should fix multiple spaces after paragraph ID', () => {
    const translatedText =
      '[P2]   First paragraph.\n[P3]    Second paragraph.\n[P4]  Third paragraph.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toContain('[P2] First')
    expect(result).toContain('[P3] Second')
    expect(result).toContain('[P4] Third')
  })

  it('should fix multiple consecutive newlines', () => {
    const translatedText =
      '[P2] First paragraph.\n\n\n[P3] Second paragraph.\n\n\n[P4] Third paragraph.'
    const result = fixAnnotatedText(translatedText)
    const lines = result.split('\n').filter((line) => line.trim())
    expect(lines.length).toBe(3)
    expect(lines[0]).toContain('[P2]')
    expect(lines[1]).toContain('[P3]')
    expect(lines[2]).toContain('[P4]')
  })

  it('should append lines without paragraph IDs to previous line', () => {
    const translatedText =
      '[P2] First paragraph.\nContinuation text.\n[P3] Second paragraph.\n[P4] Third paragraph.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toContain('[P2] First paragraph. Continuation text.')
    expect(result).toContain('[P3] Second paragraph.')
    expect(result).toContain('[P4] Third paragraph.')
  })

  it('should fix combined formatting issues', () => {
    const translatedText =
      'Prefix[P2]First paragraph.\n\n\n[P3]   Second paragraph.\n[P4]Third paragraph.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toContain('[P2] First')
    expect(result).toContain('[P3] Second')
    expect(result).toContain('[P4] Third')
  })

  it('should return empty string for empty input', () => {
    expect(fixAnnotatedText('')).toBe('')
    expect(fixAnnotatedText('   ')).toBe('')
  })

  it('should remove text before first paragraph ID', () => {
    const translatedText = 'Some preamble text[P2] First paragraph.\n[P3] Second paragraph.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toMatch(/^\[P2\]/)
    expect(result).not.toContain('Some preamble text')
  })

  it('should handle single paragraph', () => {
    const translatedText = '[P5] Single paragraph.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toBe(translatedText)
  })

  it('should fix missing newline and space together', () => {
    const translatedText = 'Text[P2]First paragraph.\n[P3]Second paragraph.\n[P4]Third paragraph.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toContain('[P2] First')
    expect(result).toContain('[P3] Second')
    expect(result).toContain('[P4] Third')
  })

  it('should preserve content while fixing format', () => {
    const translatedText =
      '[P2]First paragraph with content.\n[P3]Second paragraph with content.\n[P4]Third paragraph with content.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toContain('First paragraph with content')
    expect(result).toContain('Second paragraph with content')
    expect(result).toContain('Third paragraph with content')
  })

  it('should handle text without paragraph IDs', () => {
    const translatedText = 'No paragraph IDs in this text at all.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toBe(translatedText)
  })

  it('should detect merged paragraphs and use [P1,2] format', () => {
    const translatedText = '[P1] First paragraph.\nMerged content.\n[P3] Third paragraph.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toContain('[P1,2]')
    expect(result).toContain('First paragraph. Merged content.')
    expect(result).toContain('[P3] Third paragraph.')
  })

  it('should detect multiple merged paragraphs and use [P1,2,3] format', () => {
    const translatedText =
      '[P1] First paragraph.\nMerged content 2.\nMerged content 3.\n[P4] Fourth paragraph.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toContain('[P1,2,3]')
    expect(result).toContain('First paragraph. Merged content 2. Merged content 3.')
    expect(result).toContain('[P4] Fourth paragraph.')
  })

  it('should handle multiple merged paragraph sequences', () => {
    const translatedText = '[P1] First.\nMerged 2.\n[P3] Third.\nMerged 4.\nMerged 5.\n[P6] Sixth.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toContain('[P1,2]')
    expect(result).toContain('[P3,4,5]')
    expect(result).toContain('[P6]')
  })

  it('should not add merged format when paragraphs are sequential', () => {
    const translatedText = '[P1] First paragraph.\n[P2] Second paragraph.\n[P3] Third paragraph.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toContain('[P1] First paragraph.')
    expect(result).toContain('[P2] Second paragraph.')
    expect(result).toContain('[P3] Third paragraph.')
    expect(result).not.toContain('[P1,2]')
    expect(result).not.toContain('[P1,2,3]')
  })

  it('should handle merged paragraphs at the end', () => {
    const translatedText = '[P1] First paragraph.\n[P2] Second paragraph.\nMerged content.'
    const result = fixAnnotatedText(translatedText)
    expect(result).toContain('[P1] First paragraph.')
    expect(result).toContain('[P2] Second paragraph. Merged content.')
  })
})
