import lists from "./filter-lists.json" with {type: 'json'};
import { getRequestsInstance } from "../../requests/requests.js";
import logger from "../../logger.js";

/**
 * Helper function to process word matches and add them to foundWords collection
 * @param {string} text - The text to search in
 * @param {string} pattern - The regex pattern to search for
 * @param {string} listName - The name of the list containing this pattern
 * @param {Map} foundWords - The collection to store found matches
 */
function processWordMatches(text, pattern, listName, foundWords) {
  // Skip empty or invalid patterns
  if (!pattern || typeof pattern !== 'string' || pattern.trim() === '') {
    return;
  }

  try {
    const regex = new RegExp(pattern, "gi");
    const matches = Array.from(text.matchAll(regex));

    if (matches.length > 0) {
      if (!foundWords.has(listName)) {
        foundWords.set(listName, []);
      }
      foundWords.get(listName).push({
        expression: regex,
        matched: matches[0][0],
        input: text.substring(matches[0].index - 15, matches[0].index + 10),
        count: matches.length,
      });
    }
  } catch (error) {
    logger.warn(`Invalid regex pattern: ${pattern}`, {
      service: "filter",
      error: error.message,
      listName,
    });
  }
}

/**
 * Checks if words or phrases from the given text are included in any of the lists.
 *
 * @param {string} text - The text to check for words or phrases.
 * @return {Object|boolean} - An object with list names as keys and arrays of found words/phrases as values, or false if nothing is found.
 */
export default async function checkWord(text) {
  const foundWords = new Map();

  // Check against local filter lists
  Object.entries(lists.wordesOfFilter).forEach(([listName, words]) => {
    words.forEach((word) => {
      processWordMatches(text, word, listName, foundWords);
    });
  });

  // Check against web-based lists
  const { colorMapping } = await getWebLists();
  Object.entries(colorMapping).forEach(([name, list]) => {
    if (!list.regexs || !Array.isArray(list.regexs)) {
      return;
    }
    
    const words = list.regexs;
    words.forEach((wordObj) => {
      // Handle both old format { word: pattern } and new format { pattern: pattern }
      const pattern = wordObj.pattern || wordObj.word;
      if (pattern) {
        processWordMatches(text, pattern, name, foundWords);
      }
    });
  });

  if (foundWords.size > 0) {
    logger.info("Found words:", {
      service: "filter",
      foundWords: Object.fromEntries(foundWords),
    });
  }

  return foundWords.size > 0 ? Object.fromEntries(foundWords) : false;
}

async function getWebLists() {
  if (globalThis.colorMapping) {
    return { colorMapping: globalThis.colorMapping };
  }

  try {
    const { parse } = await getRequestsInstance("hamichlol").parse({
      page: "מדיה_ויקי:Gadget-checkWords.json",
    });
    const colorMapping = parse.wikitext["*"]
      ? JSON.parse(parse.wikitext["*"])
      : {};
    globalThis.colorMapping = { colorMapping };
    return { colorMapping };
  } catch (error) {
    logger.warn("Failed to fetch web lists:", {
      service: "filter",
      error: error.message,
    });
    return { colorMapping: {} };
  }
}
