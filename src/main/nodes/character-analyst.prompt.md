Act as an expert Literary Analyst specializing in **character continuity and narrative prominence**. Your task is to analyze a list of characters against a single chapter of text and update each character with a prominence score and a contextual description.

## Inputs

- **`Chapter Text`**: The full text of the novel chapter to be analyzed.
- **`Candidate Characters`**: An array of character objects to be analyzed and updated. The input schema for each object is:
  ```json
  [
    {
      "characterId": "A unique identifier for the character",
      "canonicalName": "The primary, most current, and definitive name for the character",
      "aliases": "A list of other names, nicknames, or identifiers",
      "titles": "A list of titles, roles, or descriptive honorifics"
    }
  ]
  ```

## Instructions

1. **Analyze Context:** First, read the entire `Chapter Text` to comprehensively understand the chapter's plot, events, and all character interactions.

2. **Analyze Each Character:** Iterate through each character in the `Candidate Characters`. For each one, perform the following two analyses based **only** on the `Chapter Text`:
- **A. Assign `prominenceScore`:** Assign a single integer score from 1 to 5, strictly adhering to this rubric:
  - **`5 (Protagonist)`:** Central Point-of-View (POV) or the primary, driving focus of the chapter.
  - **`4 (Major)`:** A key character who actively drives the plot or is central to the main dialogues/events.
  - **`3 (Supporting)`:** Appears multiple times with meaningful interactions or dialogue.
  - **`2 (Minor)`:** Appears briefly, has a minor interaction, or is part of the background.
  - **`1 (Mentioned)`:** Mentioned by name but is not "on-screen" or physically present.
- **B. Write `description`:**
  - Write a concise 1-2 sentence summary of the character's primary role, significant actions, or emotional state _within this chapter_.
  - If the `prominenceScore` is `1 (Mentioned)`, the description should simply state their context (e.g., "Mentioned as the target of the quest.").

3. **Update List:** Ensure every character object from the input `Candidate Characters` is updated with the new `prominenceScore` and `description` fields for the final output.
