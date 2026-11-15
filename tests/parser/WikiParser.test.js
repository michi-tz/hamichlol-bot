import { describe, test, expect } from '@jest/globals';
import { nextWikiText, noWikiEndTagIndex } from '../../src/parser/WikiParser.js';

describe('noWikiEndTagIndex', () => {
  test('returns the index right after </nowiki> when present', () => {
    expect(noWikiEndTagIndex('abc</nowiki>def', 0)).toBe(12);
  });

  test('returns -1 when there is no </nowiki> tag', () => {
    expect(noWikiEndTagIndex('abcdef', 0)).toBe(-1);
  });

  test('searches starting from the given index', () => {
    const text = '</nowiki>abc</nowiki>def';
    expect(noWikiEndTagIndex(text, 5)).toBe(21);
  });
});

describe('nextWikiText', () => {
  test('finds a simple search string', () => {
    expect(nextWikiText('abc]]def', 0, ']]', true)).toBe(3);
  });

  test('returns -1 when the search string is not found', () => {
    expect(nextWikiText('abcdef', 0, ']]', true)).toBe(-1);
  });

  test('skips over <nowiki>...</nowiki> spans when searching', () => {
    // The ']]' inside <nowiki>...</nowiki> must be ignored; only the one
    // after the closing tag should be matched.
    const text = '<nowiki>]]</nowiki>]]end';
    expect(nextWikiText(text, 0, ']]', true)).toBe(19);
  });

  test('skips over <!-- ... --> comments when searching', () => {
    const text = '<!-- ]] -->]]end';
    expect(nextWikiText(text, 0, ']]', true)).toBe(11);
  });

  test('skips over balanced {{ }} templates when ignoreTemplates is false', () => {
    const text = '{{template with ]] inside}}]]end';
    expect(nextWikiText(text, 0, ']]', false)).toBe(27);
  });

  test('does not skip over templates when ignoreTemplates is true', () => {
    const text = '{{template with ]] inside}}';
    expect(nextWikiText(text, 0, ']]', true)).toBe(16);
  });

  test('skips over balanced single-brace {{ }} groups when ignoreTemplates is false', () => {
    const text = '{single ] brace}]]end';
    expect(nextWikiText(text, 0, ']]', false)).toBe(16);
  });

  test('skips over [ ... ] bracket groups regardless of ignoreTemplates', () => {
    const text = '[single ] bracket]]end';
    expect(nextWikiText(text, 0, ']]', true)).toBe(17);
  });

  test('returns -1 immediately when currIndex is at or past text length and search string not found there', () => {
    expect(nextWikiText('abc', 3, ']]', true)).toBe(-1);
  });

  test('finds target string starting exactly at currIndex', () => {
    expect(nextWikiText('[[link]]', 0, '[[', true)).toBe(0);
  });
});
