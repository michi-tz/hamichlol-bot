import { describe, test, expect } from '@jest/globals';
import { extractCookie } from '../../../src/requests/utils/cookie.js';

describe('extractCookie', () => {
  describe('input validation / edge cases', () => {
    test('returns empty string for undefined input', () => {
      expect(extractCookie(undefined)).toBe('');
    });

    test('returns empty string for null input', () => {
      expect(extractCookie(null)).toBe('');
    });

    test('returns empty string for an empty array', () => {
      expect(extractCookie([])).toBe('');
    });

    test('returns empty string for an empty string', () => {
      expect(extractCookie('')).toBe('');
    });
  });

  describe('string input', () => {
    test('returns the string unchanged when a non-empty string is passed', () => {
      expect(extractCookie('sessionid=abc123')).toBe('sessionid=abc123');
    });
  });

  describe('array input', () => {
    test('extracts the cookie pair (before the first ";") from a single entry', () => {
      expect(extractCookie(['sessionid=abc123; Path=/; HttpOnly'])).toBe('sessionid=abc123');
    });

    test('joins multiple cookie entries with ";"', () => {
      const cookies = [
        'sessionid=abc123; Path=/; HttpOnly',
        'csrftoken=xyz789; Path=/',
      ];
      expect(extractCookie(cookies)).toBe('sessionid=abc123;csrftoken=xyz789');
    });

    test('keeps an entry unchanged if it has no attributes to strip', () => {
      expect(extractCookie(['foo=bar'])).toBe('foo=bar');
    });

    test('handles entries containing only attributes gracefully', () => {
      // First ";"-delimited part is taken verbatim, even if empty-looking.
      expect(extractCookie(['; Path=/'])).toBe('');
    });
  });
});
