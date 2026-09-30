import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { checkBot, detectTemplateCategory } from '../../src/import/bot_pages.js';

describe('bot_pages.js - detectTemplateCategory and checkBot functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectTemplateCategory', () => {
    describe('Input validation', () => {
      test('should return false for null or undefined input', () => {
        expect(detectTemplateCategory(null)).toBe(false);
        expect(detectTemplateCategory(undefined)).toBe(false);
      });

      test('should return false for non-string input', () => {
        expect(detectTemplateCategory(123)).toBe(false);
        expect(detectTemplateCategory({})).toBe(false);
        expect(detectTemplateCategory([])).toBe(false);
        expect(detectTemplateCategory(true)).toBe(false);
      });

      test('should return false for empty string', () => {
        expect(detectTemplateCategory('')).toBe(false);
      });

      // NOTE: documenting existing behavior - a non-empty string that doesn't
      // trigger the `!text` guard (e.g. whitespace-only) falls through to the
      // matching loop, which initializes `foundCategory` to `null` and never
      // finds a match, so `null` (not `false`) is returned. This differs from
      // the "return false" cases above; it is pre-existing behavior of
      // src/import/bot_pages.js and is intentionally left unchanged.
      test('should return null for whitespace-only string (no match found)', () => {
        expect(detectTemplateCategory('   ')).toBeNull();
        expect(detectTemplateCategory('\n\t\r')).toBeNull();
      });
    });

    describe('Template matching', () => {
      // NOTE: documenting existing behavior - when no template in the text
      // matches any configured category, `detectTemplateCategory` returns the
      // initial `null` value of `foundCategory`, not `false`.
      test('should return null when no sport templates are found', () => {
        const text = 'זה טקסט ללא תבניות ספורט';
        expect(detectTemplateCategory(text)).toBeNull();
      });

      // NOTE: documenting existing behavior - despite the JSDoc for
      // detectTemplateCategory advertising an `(Array|string|boolean)` return
      // type, the implementation only ever assigns a single category *name*
      // string (e.g. "sport") to `foundCategory`, never an array. This test
      // reflects the real, current return type rather than the documented one.
      test('should return the category name (string) when a sport template is found', () => {
        const text = 'זה עמוד על {{אישיות כדורגל}} מישהו';
        const result = detectTemplateCategory(text);
        expect(typeof result).toBe('string');
        expect(result).toBe('sport');
      });

      test('should return a single category name when multiple sport templates from same category are found', () => {
        const text = 'עמוד על {{אישיות כדורגל}} ו{{ספורטאי}} גדול';
        const result = detectTemplateCategory(text);
        expect(result).toBe('sport');
      });

      test('should handle partial template matches', () => {
        const text = 'זה עמוד עם {{אישיות כדורגל|שם הכדורגלן}}';
        const result = detectTemplateCategory(text);
        expect(result).toBe('sport');
      });

      // NOTE: documenting existing behavior - detectTemplateCategory only
      // scans for `{{templateName` occurrences, so plain "קטגוריה:" wiki
      // category markup (without surrounding template braces) is not matched
      // and the function returns null here, even though the text mentions a
      // sport-related category name.
      test('should not match plain category markup without template braces', () => {
        const text = 'עמוד עם קטגוריה:אליפו נות ספורט';
        const result = detectTemplateCategory(text);
        expect(result).toBeNull();
      });

      // NOTE: documenting existing behavior - the main matching loop
      // (`for (let listName in categories) { ... }`) only `break`s out of
      // the *inner* loop over a single category's template list once a match
      // is found; there is no outer `break`, so it keeps iterating over every
      // remaining category. If a text contains templates from more than one
      // category, `foundCategory` ends up holding the *last* matching
      // category in the `templateCategories.json` key order ("tv" here),
      // not the first one encountered ("sport") as might naively be expected.
      test('should return the LAST matching category (not the first) when templates from multiple categories are present', () => {
        const text = 'עמוד על {{אישיות כדורגל}} שהוא גם {{אישיות משחק}}';
        const result = detectTemplateCategory(text);
        expect(result).toBe('tv');
        expect(result).not.toBe('sport');
      });
    });

    describe('Special cases', () => {
      test('should handle mixed Hebrew and English text', () => {
        const text = 'This is a page about {{אישיות כדורגל}} someone';
        const result = detectTemplateCategory(text);
        expect(result).toBe('sport');
      });

      test('should handle special characters in templates', () => {
        const text = 'עמוד עם {{אישיות כדורגל|שם=כדורגלן}} ותבניות נוספות';
        const result = detectTemplateCategory(text);
        expect(result).toBe('sport');
      });

      test('should handle large text efficiently', () => {
        const largeText = 'מילה '.repeat(1000) + '{{ספורטאי}}';
        const startTime = Date.now();
        const result = detectTemplateCategory(largeText);
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(100); // Should complete in less than 100ms
        expect(result).toBe('sport');
      });
    });
  });

  describe('checkBot (deprecated function)', () => {
    test('should work but show deprecation warning', () => {
      const text = 'עמוד עם {{אישיות כדורגל}} כלשהו';
      const result = checkBot(text);
      expect(result).toBe('sport');
    });

    test('should return same result as detectTemplateCategory', () => {
      const text = 'עמוד עם {{ספורטאי}} כלשהו';
      const newResult = detectTemplateCategory(text);
      const oldResult = checkBot(text);
      expect(oldResult).toEqual(newResult);
    });

    test('should handle empty and invalid inputs same as new function', () => {
      expect(checkBot(null)).toBe(false);
      expect(checkBot('')).toBe(false);
      expect(checkBot(123)).toBe(false);
      
      expect(checkBot(null)).toEqual(detectTemplateCategory(null));
      expect(checkBot('')).toEqual(detectTemplateCategory(''));
      expect(checkBot(123)).toEqual(detectTemplateCategory(123));
    });
  });
});
