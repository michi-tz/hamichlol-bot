import { describe, test, expect } from '@jest/globals';
import {
  findStructureAtIndex,
  nextWikiText,
  parseWikiStructures,
} from '../../src/parser/WikiParser.js';

// Upstream replaced the old `noWikiEndTagIndex` helper with a structure
// parser (`parseWikiStructures` / `findStructureAtIndex`). The <nowiki>
// handling it used to cover is tested through those functions below.

describe('parseWikiStructures', () => {
  test('parses a template without a startIndex', () => {
    expect(parseWikiStructures('{{template}} text')).toStrictEqual([
      { type: 'template', start: 0, end: 12 },
    ]);
  });

  test('starts parsing at startIndex', () => {
    expect(parseWikiStructures('{{a}} {{template}} after', 6)).toStrictEqual([
      { type: 'template', start: 6, end: 18 },
    ]);
  });

  test('returns nested structures sorted by start', () => {
    const text = '{{t|[[x|y]]|{{{p}}}|[http://a b]}}';
    expect(parseWikiStructures(text).map(({ type }) => type)).toEqual([
      'template', 'wikilink', 'parameter', 'link',
    ]);
  });

  test.each([
    ['nowiki', '<nowiki>', '</nowiki>'],
    ['comment', '<!--', '-->'],
    ['math', '<math>', '</math>'],
  ])('ignores all wiki syntax inside %s', (type, opening, closing) => {
    const hiddenText = '{{hidden}} {{{parameter}}} {brace} [[wikilink]] [link]';
    const inertEnd = opening.length + hiddenText.length + closing.length;
    const text = `${opening}${hiddenText}${closing} {{visible}}`;
    expect(parseWikiStructures(text)).toStrictEqual([
      { type, start: 0, end: inertEnd },
      { type: 'template', start: inertEnd + 1, end: text.length },
    ]);
  });

  test('does not report unclosed structures', () => {
    expect(parseWikiStructures('{{open [[link')).toEqual([]);
  });
});

describe('findStructureAtIndex', () => {
  const text = '<nowiki>x</nowiki> {{t|a}}';
  const structures = parseWikiStructures(text);

  test('finds the <nowiki> span containing an index', () => {
    expect(findStructureAtIndex(structures, 3)).toEqual({ type: 'nowiki', start: 0, end: 18 });
  });

  test('finds templates unless ignoreTemplates is set', () => {
    expect(findStructureAtIndex(structures, 22)).toEqual({ type: 'template', start: 19, end: 26 });
    expect(findStructureAtIndex(structures, 22, true)).toBeUndefined();
  });

  test('the start index itself is not inside the structure', () => {
    expect(findStructureAtIndex(structures, 0)).toBeUndefined();
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

  test('skips over <math> spans when searching', () => {
    expect(nextWikiText('<math>{{test}}</math>{{test}}', 0, '{{test}}')).toBe(21);
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

  test('finds text after a [ ... ] bracket group', () => {
    const text = '[single ] bracket]]end';
    expect(nextWikiText(text, 0, ']]', true)).toBe(17);
  });

  test('skips over [ ... ] external links only when ignoreTemplates is false', () => {
    // Upstream behaviour change: the old copy skipped single-bracket groups
    // even with ignoreTemplates=true; now only <nowiki>, comments and <math>
    // are skipped in that mode.
    expect(nextWikiText('[a b] b', 0, 'b', false)).toBe(6);
    expect(nextWikiText('[a b] b', 0, 'b', true)).toBe(3);
  });

  test('skips over {{{ }}} template parameters', () => {
    expect(nextWikiText('{{{param|default}}} default', 0, 'default')).toBe(20);
  });

  test('an unclosed <nowiki> or comment does not hide the rest of the text', () => {
    expect(nextWikiText('a <nowiki>{{x}}', 0, '{{x}}')).toBe(10);
    expect(nextWikiText('a <!--{{x}}', 0, '{{x}}')).toBe(6);
  });

  test('returns -1 immediately when currIndex is at or past text length and search string not found there', () => {
    expect(nextWikiText('abc', 3, ']]', true)).toBe(-1);
  });

  test('finds target string starting exactly at currIndex', () => {
    expect(nextWikiText('[[link]]', 0, '[[', true)).toBe(0);
  });
});
