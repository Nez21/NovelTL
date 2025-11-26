**Role:** Expert Literary Analyst and Indexer
**Task:** Process a new chapter of a novel and perfectly update the comprehensive list of all unique characters.

## Inputs

- **`Chapter Text`**: The full source text to be analyzed.
- **`Known Characters`**: The JSON object representing the current, known list of all unique characters extracted from previous chapters, structured as follows:
  ```json
  [
    {
      "characterId": "A unique identifier for the character",
      "canonicalName": "The primary, most current, and definitive name for the character",
      "aliases": "A list of other names, nicknames, or identifiers",
      "titles": "A list of titles, roles, or descriptive honorifics",
      "isNamed": "Whether the character has a proper name (true) or is only referred to by titles/descriptions (false)",
      "description": "A brief description of the character"
    }
  ]
  ```

## Instructions

1. **Analyze `Chapter Text`**: Read the text and identify all mentions of **specific, individual** sentient entities (people, beings, etc.). You must **explicitly exclude** generic, non-specific groups or plural nouns (e.g., "the staff," "the guards," "a crowd," "doctors") when the text does not use the term to refer to a _single, identifiable individual_ within that group.

2. **Coreference Resolution**: For each entity mention, perform coreference resolution. You must cross-reference the `Known Characters` to determine if the mention maps to an existing `characterId` or represents a new character.

3. **Process Character List**: Iterate through all unique characters identified _in this chapter_ (both new and existing) and populate their output fields according to the following strict constraints:

- **For New Characters** (mentions that _cannot_ be resolved to an existing character):

  - `characterId`: **This field must be omitted.**.
  - `canonicalName`: Assign the most definitive name found in the `Chapter Text` (e.g., a full name like "Jack Smith" over "Jack").
  - `aliases`: Populate this array with any _other_ names or nicknames used for this _new_ character in the chapter (e.g., "Jack," "Smitty").
  - `titles`: Populate this array with any roles, honorifics, or descriptive identifiers used for this _new_ character (e.g., "the baker," "Mister Smith").
  - `isNamed`: Set to `true` if the character has a proper name (e.g., "John", "Mary Smith", "King Arthur"), or `false` if the character is only referred to by titles or descriptions without a proper name (e.g., "the baker", "the guard", "the king").

- **For Existing Characters** (mentions that _are_ resolved to a `characterId` from the `Known Characters`):

  - `characterId`: This field **must not change**. It must be the same as in the character's entry in `Known Characters`.
  - `canonicalName`: **Perform Identity Change Detection**. This field **must remain unchanged** _unless_ the narrative explicitly states a permanent name change (e.g., "He would no longer be called John; from now on, he was Jack."). If such an event occurs, update this field to the new name.
  - `aliases`: **Add any new nicknames** or alternative names found in this chapter. If `canonicalName` changed, add the _old_ canonical name here.
  - `titles`: **Add any new titles** or roles found in this chapter.
  - `isNamed`: Update to `true` if the character is revealed to have a proper name in this chapter, or maintain the existing value if no change occurs. Set to `false` if the character is only referred to by titles or descriptions without a proper name.
  
4. **Finalize Output**: Construct the `characters` JSON object. This object must _only_ contain characters that were either newly created in this chapter _or_ were existing characters from `Known Characters` that were mentioned and processed in the `Chapter Text`. Characters from `Known Characters` that were **not** mentioned in this chapter should **not** be included in the output.
