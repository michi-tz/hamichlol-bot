import { describe, test, expect } from '@jest/globals';
import * as utilities from '../../src/parser/utilities.js';
import * as templateParser from '../../src/parser/newTemplateParser.js';
import * as wikiDataSqlQueries from '../../src/parser/WikiDataSqlQueries.js';
import * as wikiLinkParser from '../../src/parser/wikiLinkParser.js';
import * as paragraphParser from '../../src/parser/paragraphParser.js';

// These modules previously failed to load as ES modules (CommonJS syntax,
// a missing `escapeRegex` export and a wrong relative import path). Importing
// them statically here means any regression makes this whole file fail.

describe('parser modules load as ES modules with their expected exports', () => {
  test.each([
    ['utilities.js', utilities, [
      'escapeRegex', 'currencyName', 'prettyNumericValue', 'getLocalDate',
      'getLocalTimeAndDate', 'getFullYear', 'monthToNumber', 'parseLocalDate',
    ]],
    ['newTemplateParser.js', templateParser, [
      'findTemplates', 'findTemplate', 'getTemplateKeyValueData', 'templateFromKeyValueData',
      'getTemplateArrayData', 'templateFromArrayData', 'getTemplateData', 'templateFromTemplateData',
    ]],
    ['WikiDataSqlQueries.js', wikiDataSqlQueries, [
      'companiesWithMayaId', 'personWithBirthdayInDay', 'companiesWithTicker',
    ]],
    ['wikiLinkParser.js', wikiLinkParser, [
      'getInnerLinks', 'getInnerLink', 'getExternalLinks', 'getExternalLink',
    ]],
    ['paragraphParser.js', paragraphParser, [
      'getParagraphContent', 'getAllParagraphs', 'getUsersFromTagParagraph',
    ]],
  ])('%s exposes its named exports', (_name, mod, exportNames) => {
    expect(Object.keys(mod).sort()).toEqual([...exportNames].sort());
    exportNames.forEach((name) => expect(mod[name]).toBeDefined());
  });
});

describe('utilities', () => {
  const {
    escapeRegex, prettyNumericValue, getLocalDate, getFullYear, parseLocalDate,
  } = utilities;

  test('escapeRegex escapes every regex metacharacter', () => {
    const special = 'a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o';
    expect(new RegExp(`^${escapeRegex(special)}$`).test(special)).toBe(true);
    expect(escapeRegex('a.b')).toBe('a\\.b');
    expect(new RegExp(escapeRegex('a.b')).test('axb')).toBe(false);
  });

  test('escapeRegex leaves plain (including Hebrew) text unchanged', () => {
    expect(escapeRegex('ראשון שני')).toBe('ראשון שני');
  });

  test('prettyNumericValue formats values given in thousands', () => {
    expect(prettyNumericValue('0')).toBe('0 [[שקל חדש|ש"ח]]');
    expect(prettyNumericValue('123')).toBe('123 [[1000 (מספר)|אלף]] [[שקל חדש|ש"ח]]');
    expect(prettyNumericValue('1234')).toBe('1.23 [[מיליון]] [[שקל חדש|ש"ח]]');
    expect(prettyNumericValue('1234567', 'USD')).toBe('1.23 [[מיליארד]] [[דולר אמריקאי|דולר]]');
  });

  test('getFullYear expands two-digit years', () => {
    expect(getFullYear('99')).toBe('1999');
    expect(getFullYear('05')).toBe('2005');
    expect(getFullYear('2010')).toBe('2010');
  });

  test('getLocalDate returns an empty string for invalid dates', () => {
    expect(getLocalDate('not a date')).toBe('');
  });

  test('parseLocalDate parses a Hebrew local date', () => {
    expect(parseLocalDate('5 בינואר 2020').toISOString()).toBe('2020-01-05T00:00:00.000Z');
    expect(parseLocalDate('17 בספטמבר 2021').toISOString()).toBe('2021-09-17T00:00:00.000Z');
  });

  test('parseLocalDate rejects incomplete input', () => {
    expect(() => parseLocalDate('5 בינואר')).toThrow('Invalid date');
    expect(Number.isNaN(+parseLocalDate('5 בינואר', false))).toBe(true);
  });
});

describe('newTemplateParser', () => {
  const {
    findTemplates, findTemplate, getTemplateKeyValueData, templateFromKeyValueData,
    getTemplateArrayData, templateFromArrayData, getTemplateData, templateFromTemplateData,
  } = templateParser;

  test('findTemplates finds templates by exact name, skipping same-prefix templates', () => {
    const text = 'a {{משרה1|q=1}} b {{משרה|x=1}} c {{משרה |y=2}} d {{משרה}}';
    expect(findTemplates(text, 'משרה')).toEqual(['{{משרה|x=1}}', '{{משרה |y=2}}', '{{משרה}}']);
  });

  test('findTemplates handles nested templates and links', () => {
    const text = 'start {{t|a={{inner|1}}|b=[[x|y]]}} end';
    expect(findTemplates(text, 't')).toEqual(['{{t|a={{inner|1}}|b=[[x|y]]}}']);
  });

  test('findTemplate returns an empty string when the template is missing', () => {
    expect(findTemplate('no templates here', 't')).toBe('');
  });

  test('templateFromKeyValueData / findTemplate / getTemplateKeyValueData round trip', () => {
    const data = { a: '1', b: '[[x|y]]', c: '{{z|w}}' };
    const templateText = templateFromKeyValueData(data, 'משרה');
    expect(templateText).toBe('{{משרה\n|a=1\n|b=[[x|y]]\n|c={{z|w}}\n}}');
    const article = `intro\n${templateText}\nrest of article`;
    const found = findTemplate(article, 'משרה');
    expect(found).toBe(templateText);
    expect(getTemplateKeyValueData(found)).toEqual(data);
  });

  test('templateFromKeyValueData without new lines', () => {
    expect(templateFromKeyValueData({ a: '1', b: '2' }, 't', false)).toBe('{{t|a=1|b=2}}');
  });

  test('getTemplateArrayData returns positional parameters', () => {
    expect(getTemplateArrayData('{{t|a|b|3=c|k=v}}', 't')).toEqual(['a', 'b', '3=c', 'k=v']);
    expect(getTemplateArrayData('{{t|a|b|3=c|k=v}}', 't', undefined, true)).toEqual(['a', 'b', 'c']);
    expect(getTemplateArrayData('{{t}}', 't')).toEqual([]);
    expect(templateFromArrayData(['a', 'b'], 't')).toBe('{{t|a|b}}');
  });

  test('getTemplateData / templateFromTemplateData round trip', () => {
    const templateText = '{{t|a|[[x|y]]|k=v}}';
    const data = getTemplateData(templateText, 't');
    expect(data).toEqual({ arrayData: ['a', '[[x|y]]'], keyValueData: { k: 'v' } });
    expect(templateFromTemplateData(data, 't')).toBe(templateText);
  });
});

describe('WikiDataSqlQueries', () => {
  test('personWithBirthdayInDay interpolates the day and month', () => {
    const query = wikiDataSqlQueries.personWithBirthdayInDay(5, 3);
    expect(query).toContain('(MONTH(?birthDate)) = 3 )');
    expect(query).toContain('(DAY(?birthDate)) = 5 )');
  });

  test('static queries return SPARQL SELECT strings', () => {
    expect(wikiDataSqlQueries.companiesWithMayaId()).toContain('wdt:P10817');
    expect(wikiDataSqlQueries.companiesWithTicker()).toContain('SELECT ?companyId');
  });
});

describe('wikiLinkParser', () => {
  const {
    getInnerLinks, getInnerLink, getExternalLinks, getExternalLink,
  } = wikiLinkParser;

  test('getInnerLinks parses plain, piped, colon-prefixed and multi-parameter links', () => {
    expect(getInnerLinks('a [[x]] b [[:y|Y]] [[File:f.png|thumb|cap]]')).toEqual([
      { link: 'x', text: 'x' },
      { link: 'y', text: 'Y' },
      { link: 'File:f.png', text: 'thumb', params: ['thumb', 'cap'] },
    ]);
  });

  test('getInnerLink returns the first link or undefined', () => {
    expect(getInnerLink('see [[first|1]] and [[second]]')).toEqual({ link: 'first', text: '1' });
    expect(getInnerLink('no links')).toBeUndefined();
  });

  test('getExternalLinks parses external links and ignores inner links', () => {
    expect(getExternalLinks('see [https://a.com A site] and [[inner]] [http://b.org]')).toEqual([
      { link: 'https://a.com', text: 'A site' },
      { link: 'http://b.org', text: '' },
    ]);
    expect(getExternalLink('[https://a.com A]')).toEqual({ link: 'https://a.com', text: 'A' });
  });
});

describe('paragraphParser', () => {
  const { getParagraphContent, getAllParagraphs, getUsersFromTagParagraph } = paragraphParser;
  const article = [
    'lead',
    '== ראשון ==',
    'content1',
    '=== sub ===',
    'subc',
    '== שני (2) ==',
    'content2 [[משתמש:דוד|דוד]] [[משתמשת:רות]] [[other]] {{א|יוסי}}',
    '',
  ].join('\n');

  test('getParagraphContent returns section content including subsections', () => {
    expect(getParagraphContent(article, 'ראשון')).toBe('content1\n=== sub ===\nsubc');
  });

  test('getParagraphContent escapes regex characters in the heading', () => {
    expect(getParagraphContent(article, 'שני (2)')).toBe(
      'content2 [[משתמש:דוד|דוד]] [[משתמשת:רות]] [[other]] {{א|יוסי}}',
    );
  });

  test('getParagraphContent with title and for a missing section', () => {
    expect(getParagraphContent(article, 'ראשון', undefined, true)).toBe(
      '== ראשון ==\ncontent1\n=== sub ===\nsubc\n',
    );
    expect(getParagraphContent(article, 'missing')).toBeNull();
  });

  test('getAllParagraphs returns every top-level section with its title', () => {
    expect(getAllParagraphs(article)).toEqual([
      '== ראשון ==\ncontent1\n=== sub ===\nsubc\n',
      '== שני (2) ==\ncontent2 [[משתמש:דוד|דוד]] [[משתמשת:רות]] [[other]] {{א|יוסי}}\n',
    ]);
  });

  test('getUsersFromTagParagraph collects user links and {{א}} templates', () => {
    expect(getUsersFromTagParagraph(article, 'שני (2)')).toEqual([
      '[[משתמש:דוד|דוד]]',
      '[[משתמשת:רות]]',
      '{{א|יוסי}}',
    ]);
    expect(getUsersFromTagParagraph(article, 'missing')).toEqual([]);
  });
});
