import templateCategories from "./check/template-categories.json" with {type: 'json'};
import logger from "../logger.js";
import { getProperties, applyReplacements } from "./utils.js";

/**
 * Creates a Tionary page from provided data and classification.
 * @param {Object} data - The data object containing text and properties
 * @param {string} classification - The classification for the bot template
 * @returns {Promise<string>} - The processed text for the page
 */
export default async function createTionaryPage(data, classification) {
  try {
    if (!data || !data.text) {
      logger.error("Invalid data provided to createTionaryPage");
      throw new Error("Invalid data: missing text property");
    }

    let text = data.text;
    const sections = text.split(/==.+==/g);

    // Take only the first section (before first header) if multiple sections exist
    if (sections.length > 1) {
      text = sections[0].trim();
    }

    // If text is very long and no sections, take only the first paragraph
    if (sections.length === 1 && text.length > 2000) {
      const paragraphs = text.split("\n\n");
      text = paragraphs[0];
    }

    const replacements = [
      {
        from: /(?<!סמל\s*=\s*)\[\[(?:File|קובץ):([^|\]]+)(?:\|(?:[^\[\]]+|\[\[[^\[\]]*\]\])*)*\]\]/,
        to: ``,
      },
      { from: /{{(?:אין תמונה|תמונה להחלפה)[^}]*}}/, to: `` },
      { from: /\|\s?תמונה\s?=[^{}\n|]*\n?/, to: "" },
      { from: /\|\s?דגימת קול\s?=[^{}\n|]*\n?/, to: "" },
    ];
    const result = await applyReplacements(text, replacements);
    text = result.text;

    text = defaultsortAndCategories(text, data);
    text = text += `\n{{בוט ${classification}}}`;

    logger.info(
      `Successfully created Tionary page with classification: ${classification}`
    );
    return text;
  } catch (error) {
    logger.error("Error in createTionaryPage:", error);
    throw error;
  }
}

/**
 * Adds defaultsort and categories to the text.
 * @param {string} text - The input text
 * @param {Object} data - The data object containing properties
 * @returns {string} - Text with defaultsort and categories added
 */
function defaultsortAndCategories(text, data) {
  if (!text || typeof text !== "string") {
    return "";
  }

  try {
    let processedText = text;

    // Get defaultsort property
    if (data.properties) {
      const defaultsort = getProperties(data.properties, "defaultsort");

      // Add footnotes if needed
      if (/<\/ref>|{{הערה\|/.test(processedText)) {
        processedText += "\n===הערות שוליים===\n{{הערות שוליים}}";
      }

      // Add defaultsort
      if (defaultsort) {
        processedText += `\n{{מיון רגיל:${defaultsort}}}`;
      }
    }

    // Add categories
    if (data.text) {
      const categoryRegex = /\[\[קטגוריה:(.+)\]\]/g;
      const categories = data.text.match(categoryRegex);
      if (categories && categories.length > 0) {
        processedText += `\n${categories.join("\n") || ""}`;
      }
    }

    return processedText;
  } catch (error) {
    logger.error("Error in defaultsortAndCategories:", error);
    return text; // Return original text if error occurs
  }
}

/**
 * Returns the createTionaryPage function for creating bot pages.
 * @returns {Function} The createTionaryPage function
 */
export function botPages() {
  logger.info("Using local createTionaryPage implementation");
  return createTionaryPage;
}

/**
 * Detects template categories in the given text based on predefined template patterns.
 * This function identifies which template categories (e.g., sports, personalities) are present
 * in the text to help with automatic content classification and bot processing.
 * @param {string} text - The text to be analyzed for template patterns.
 * @returns {(Array|string|boolean)} - The found template categories if there are matches, false otherwise.
 */
export function detectTemplateCategory(text) {
  if (!text || typeof text !== "string") {
    return false;
  }

  if (!templateCategories || !templateCategories.templateCategories) {
    logger.error(
      "Invalid templateCategories configuration: templateCategories not found"
    );
    return false;
  }

  const categories = templateCategories.templateCategories;
  let foundCategory = null; // Use Set to avoid duplicates

  for (let listName in categories) {
    const categoryTemplates = categories[listName];
    if (Array.isArray(categoryTemplates)) {
      for (const word of categoryTemplates) {
        if (text.includes(`{{${word}`)) {
          foundCategory = listName;
          break; // Found one word in this list, no need to check others
        }
      }
    }
  }

  return foundCategory;
}

/**
 * @deprecated Use detectTemplateCategory instead. This function will be removed in a future version.
 * Checks if a given text contains any words from a predefined list of words related to bots.
 * @param {string} text - The text to be checked for bot-related words.
 * @returns {(Array|boolean)} - The found word list(s) if there are matches, false otherwise.
 */
export function checkBot(text) {
  logger.warn(
    "checkBot function is deprecated. Use detectTemplateCategory instead."
  );
  return detectTemplateCategory(text);
}
