import { z } from 'zod'

export const LanguageEnum = z.enum(['English', 'Vietnamese'])

export const GenderEnum = z.enum(['Male', 'Female', 'Non-Binary', 'Unknown'])

export const CharacterSchema = z.object({
  characterId: z.uuid().describe('A unique identifier for the character (e.g., UUID).'),
  canonicalName: z
    .string()
    .describe('The primary, most current, and definitive name for the character.'),
  aliases: z
    .array(z.string())
    .describe("A list of other names, nicknames, or identifiers (e.g., 'John', 'Johnny')."),
  titles: z
    .array(z.string())
    .describe(
      "A list of titles, roles, or descriptive honorifics (e.g., 'King', 'Captain', 'the baker')."
    ),
  isNamed: z
    .boolean()
    .describe(
      'Whether the character has a proper name (true) or is only referred to by titles/descriptions (false).'
    ),
  gender: GenderEnum.default('Unknown').describe(
    "The determined gender based on the character's consciousness and stated identity."
  ),
  description: z
    .string()
    .describe("A concise 1-2 sentence summary of the character's role in this chapter.")
})

export const TermCategoryEnum = z.enum([
  'Proper Nouns (Person)',
  'Proper Nouns (People)',
  'Proper Nouns (Organizations)',
  'Proper Nouns (Locations)',
  'Fictional Concepts, Systems, & Materials',
  'Titles, Ranks, & Honorifics',
  'Key Artifacts & Unique Objects',
  'Species, Creatures, & FCictional Life',
  'In-World Slang, Units, & Expletives'
])

export const TermSchema = z.object({
  term: z.string().describe('The term to be translated.'),
  category: TermCategoryEnum.exclude(['Proper Nouns (Person)']).describe(
    'The category of the term.'
  ),
  translation: z.string().describe('The translation of the term.')
})

export const EditingStatusEnum = z.enum(['Approved', 'Final Edits Required', 'Escalated To Human'])
