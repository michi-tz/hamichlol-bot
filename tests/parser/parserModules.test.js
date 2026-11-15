import { describe, test, expect } from '@jest/globals';
import * as utilities from '../../src/parser/utilities.js';
import * as templateParser from '../../src/parser/newTemplateParser.js';
import * as wikiDataSqlQueries from '../../src/parser/WikiDataSqlQueries.js';
import * as wikiLinkParser from '../../src/parser/wikiLinkParser.js';
import * as paragraphParser from '../../src/parser/paragraphParser.js';
import * as redirectParser from '../../src/parser/redirectParser.js';
import { regExpEscape } from '../../src/parser/regexpEscapePolyfill.js';

// These modules are generated from upstream by `npm run sync:parser`.
// Importing them statically here means a sync that breaks ES module loading
// (e.g. a bad import rewrite) makes this whole file fail, and the export lists
// below make any upstream API change visible in the sync pull request.

describe('parser modules load as ES modules with their expected exports', () => {
  test.each([
    ['utilities.js', utilities, [
      'currencyName', 'prettyNumericValue', 'getLocalDate', 'getLocalTimeAndDate',
      'getFullYear', 'parseLocalDate', 'promiseSequence', 'objectToFormData',
      'objectToQueryString', 'asyncGeneratorMapWithSequence', 'encodeWikiUrl',
      'hebrewGimetriya', 'fetchUrlLikeBrowser', 'convertContentToWikiPage',
      'contentFromPage', 'firstPageOf', 'getUserAgent',
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
      'getParagraphEnd', 'getParagraphContent', 'parseParagraph', 'getAllParagraphs',
      'getUsersFromTagParagraph',
    ]],
    ['redirectParser.js', redirectParser, [
      'getRedirectTargetFromContent', 'isRedirectContent',
    ]],
  ])('%s exposes its named exports', (_name, mod, exportNames) => {
    expect(Object.keys(mod).sort()).toEqual([...exportNames].sort());
    exportNames.forEach((name) => expect(mod[name]).toBeDefined());
  });
});

// Upstream dropped the local `escapeRegex` helper in favour of the ES2025
// RegExp.escape, which Node.js < 24 lacks; src/parser/regexpEscapePolyfill.js
// provides it. These tests replace the former escapeRegex tests.
describe('RegExp.escape polyfill', () => {
  test.each([regExpEscape, (s) => RegExp.escape(s)])('escapes every regex metacharacter (%#)', (escape) => {
    const special = 'a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o/p';
    expect(new RegExp(`^${escape(special)}$`).test(special)).toBe(true);
    expect(new RegExp(escape('a.b')).test('axb')).toBe(false);
    expect(new RegExp(`^${escape('a-b, c=d')}$`, 'v').test('a-b, c=d')).toBe(true);
  });

  test('matches the spec examples', () => {
    expect(regExpEscape('foo')).toBe('\\x66oo');
    expect(regExpEscape('a.b')).toBe('\\x61\\.b');
    expect(regExpEscape('(*)')).toBe('\\(\\*\\)');
    expect(regExpEscape('foo-bar')).toBe('\\x66oo\\x2dbar');
    expect(regExpEscape(' \t\n ')).toBe('\\x20\\t\\n\\u2028');
    expect(regExpEscape('\ud800')).toBe('\\ud800');
  });

  test('leaves Hebrew text unchanged (apart from spaces)', () => {
    expect(regExpEscape('ראשון שני')).toBe('ראשון\\x20שני');
  });

  test('rejects non-strings', () => {
    expect(() => regExpEscape(1)).toThrow(TypeError);
  });

  // Meaningful on Node.js >= 24, where RegExp.escape is native (on older
  // versions the "native" function is the polyfill itself).
  test('agrees with the native implementation when there is one', () => {
    const native = Object.getOwnPropertyDescriptor(RegExp, 'escape').value;
    const input = '1a.b-c d e﻿"\'`<>#&!%:;@~,=😀\udc00';
    expect(native(input)).toBe(regExpEscape(input));
  });
});

describe('utilities', () => {
  const {
    prettyNumericValue, getLocalDate, getFullYear, parseLocalDate,
    encodeWikiUrl, hebrewGimetriya, objectToQueryString,
  } = utilities;

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

  test('encodeWikiUrl encodes titles like MediaWiki URLs', () => {
    expect(encodeWikiUrl("O'Neil test")).toBe('O%27Neil_test');
  });

  test('hebrewGimetriya converts numbers to Hebrew numerals', () => {
    expect(hebrewGimetriya(1)).toBe('א');
    expect(hebrewGimetriya(15)).toBe('טו');
    expect(hebrewGimetriya(16)).toBe('טז');
    expect(hebrewGimetriya(499)).toBe('תצט');
    expect(() => hebrewGimetriya(500)).toThrow();
  });

  test('objectToQueryString encodes values', () => {
    expect(objectToQueryString({ a: 'x y', b: 'א' })).toBe('a=x%20y&b=%D7%90');
  });
});

describe('redirectParser', () => {
  const { getRedirectTargetFromContent, isRedirectContent } = redirectParser;

  test('extracts Hebrew and English redirect targets', () => {
    expect(getRedirectTargetFromContent('#הפניה [[עב-ידיים]]')).toBe('עב-ידיים');
    expect(getRedirectTargetFromContent('#REDIRECT [[Handedness]]')).toBe('Handedness');
    expect(getRedirectTargetFromContent('﻿\n\n#הפניה [[ערך יעד]]')).toBe('ערך יעד');
  });

  test('returns null for non-redirects', () => {
    expect(getRedirectTargetFromContent(' \n ')).toBeNull();
    expect(getRedirectTargetFromContent('== פתיח ==\nטקסט רגיל')).toBeNull();
    expect(getRedirectTargetFromContent('#הפניה יעד-ללא-סוגריים')).toBeNull();
    expect(getRedirectTargetFromContent('#REDIRECT [[|text]]')).toBeNull();
  });

  test('redirectOnly=false allows content after the redirect link', () => {
    const content = '#REDIRECT [[text]] [[category:redirect not to delete]]';
    expect(getRedirectTargetFromContent(content)).toBeNull();
    expect(getRedirectTargetFromContent(content, false)).toBe('text');
  });

  test('isRedirectContent', () => {
    expect(isRedirectContent('#הפניה [[עב-ידיים]]')).toBe(true);
    expect(isRedirectContent('תוכן רגיל')).toBe(false);
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

  test('findTemplates allows whitespace after "{{" and skips broken templates (upstream behaviour)', () => {
    expect(findTemplates('a {{ t|x=1}} b', 't')).toEqual(['{{ t|x=1}}']);
    expect(findTemplates('hello {{test|text=hello}} {{test|text=world', 'test')).toEqual(['{{test|text=hello}}']);
  });

  test('findTemplates does not return templates nested in a same-prefix template', () => {
    expect(findTemplates('{{תרגומים|\n* {{ת|איטלקית|barbiere}}\n}}', 'ת')).toEqual([]);
  });

  test('findTemplate returns the first template, also when nested', () => {
    const text = 'x {{template| {{test|text=hello}}{{a}}|test2}} y {{test|text=world}}';
    expect(findTemplate(text, 'test')).toBe('{{test|text=hello}}');
  });

  test('getTemplateKeyValueData handles templates without parameters and a trailing pipe', () => {
    expect(getTemplateKeyValueData('')).toEqual({});
    expect(getTemplateKeyValueData('{{template}}')).toEqual({});
    expect(getTemplateKeyValueData('{{template|test=hello|}}')).toEqual({ test: 'hello' });
  });

  test('templateFromKeyValueData with empty data (upstream: no dangling new line)', () => {
    expect(templateFromKeyValueData({}, 'name')).toBe('{{name}}');
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
