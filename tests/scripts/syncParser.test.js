import { describe, test, expect } from '@jest/globals';
import {
  GENERATED_MARKER,
  SyncError,
  convertFile,
  parseArgs,
  rewriteImports,
  stripTypes,
  validateConfig,
  verifyErasure,
} from '../../scripts/sync-parser-lib.mjs';

// Pure parts of scripts/sync-parser.mjs; no network or git involved.

const mapping = {
  'bot/wiki/WikiParser.ts': 'src/parser/WikiParser.js',
  'bot/wiki/newTemplateParser.ts': 'src/parser/newTemplateParser.js',
  'bot/utilities.ts': 'src/parser/utilities.js',
};
const ctx = {
  repo: 'https://github.com/EladHeller/wiki-bot.git',
  commit: 'a'.repeat(40),
  license: 'ISC',
  upstreamPath: 'bot/wiki/newTemplateParser.ts',
  localPath: 'src/parser/newTemplateParser.js',
  mapping,
};

describe('stripTypes', () => {
  test('erases annotations, generics, optional markers and type declarations only', () => {
    const source = [
      'export interface WikiStructure {',
      '  start: number;',
      '}',
      '',
      '// describes Data, so it goes away with it',
      'type Data = { a?: string[] };',
      '',
      '// keeps other comments',
      'export function first<T extends { type: string }>(stack: T[], type?: string): number {',
      '  const map: Record<string, number> = {}; // trailing comment',
      '  const value = (stack as unknown as T[])[0]!;',
      '  return Number(map[type!] ?? value) satisfies number;',
      '}',
      '',
    ].join('\n');
    expect(stripTypes(source)).toBe([
      '// keeps other comments',
      'export function first(stack, type) {',
      '  const map = {}; // trailing comment',
      '  const value = (stack)[0];',
      '  return Number(map[type] ?? value);',
      '}',
      '',
    ].join('\n'));
  });

  test('keeps formatting, blank lines and template literals untouched', () => {
    const source = 'export function f(a: string): string {\n  const x = `{| class\n\n! ${a}`;\n\n  return x;\n}\n';
    expect(stripTypes(source)).toBe('export function f(a) {\n  const x = `{| class\n\n! ${a}`;\n\n  return x;\n}\n');
  });

  test('removes type-only imports and imports only used as types', () => {
    const source = [
      "import { type WikiPage } from './types';",
      "import type { Other } from '../other';",
      "import { used, OnlyAType, type Gone } from './WikiParser';",
      '',
      'export const x = (p: WikiPage, o: Other, t: OnlyAType) => used(p, o, t);',
    ].join('\n');
    expect(stripTypes(source)).toBe([
      "import { used } from './WikiParser';",
      '',
      'export const x = (p, o, t) => used(p, o, t);',
    ].join('\n'));
  });

  test('handles classes: modifiers, implements, generics in calls', () => {
    const source = [
      'export class A<T> extends Base<T> implements I {',
      '  private readonly items: T[] = [];',
      '  declare foo: string;',
      '  public get(i?: number): T | undefined { return this.items.at<number>(i ?? 0) as T; }',
      '}',
    ].join('\n');
    expect(stripTypes(source)).toBe([
      'export class A extends Base {',
      '  items = [];',
      '  get(i) { return this.items.at(i ?? 0); }',
      '}',
    ].join('\n'));
  });

  test.each([
    ['enum E { A }', /enum/],
    ['namespace N { export const a = 1; }', /namespace/],
    ['class A { constructor(private a: string) {} }', /parameter property/],
  ])('refuses syntax with runtime semantics: %s', (source, message) => {
    expect(() => stripTypes(source)).toThrow(SyncError);
    expect(() => stripTypes(source)).toThrow(message);
  });

  test('fails on TypeScript parse errors', () => {
    expect(() => stripTypes('function (')).toThrow(/parse error/);
  });
});

describe('verifyErasure', () => {
  test('accepts an equivalent conversion', () => {
    expect(() => verifyErasure('let a: string = f<number>();', 'let a = f();')).not.toThrow();
  });

  test('rejects leftover TypeScript syntax', () => {
    expect(() => verifyErasure('let a: string;', 'let a: string;')).toThrow(/invalid JavaScript/);
    expect(() => verifyErasure('class A extends B<T> {}', 'class A extends B<T> {}')).toThrow(/invalid JavaScript/);
  });

  test('rejects a conversion that changes the code', () => {
    expect(() => verifyErasure('let a: string = b;', 'let a = c;')).toThrow(/does not match/);
  });
});

describe('rewriteImports', () => {
  test('adds .js to whitelisted relative imports and maps paths', () => {
    const js = [
      "import { nextWikiText } from './WikiParser';",
      "import { currencyName } from '../utilities';",
      "export { x } from \"./WikiParser.js\";",
    ].join('\n');
    expect(rewriteImports(js, ctx)).toBe([
      "import { nextWikiText } from './WikiParser.js';",
      "import { currencyName } from './utilities.js';",
      'export { x } from "./WikiParser.js";',
    ].join('\n'));
  });

  test.each([
    ["import { getUserAgent } from '../utilities/logger';", /utilities\/logger.*not in the sync whitelist/],
    ["import axios from 'axios';", /'axios' \(not a relative import\)/],
    ["import fs from 'node:fs';", /'node:fs'/],
    ["const m = await import('./WikiApi');", /bot\/wiki\/WikiApi/],
    ['const m = require(name);', /non-literal specifier/],
  ])('fails loudly for imports outside the whitelist: %s', (js, message) => {
    expect(() => rewriteImports(js, ctx)).toThrow(SyncError);
    expect(() => rewriteImports(js, ctx)).toThrow(message);
  });
});

describe('convertFile', () => {
  test('produces header, polyfill import and converted code', () => {
    const source = [
      "import { nextWikiText } from './WikiParser';",
      '',
      'export function find(text: string, name: string): number {',
      '  return nextWikiText(text, 0, RegExp.escape(name));',
      '}',
      '',
    ].join('\n');
    const out = convertFile(source, {
      ...ctx,
      polyfills: { 'RegExp.escape': 'src/parser/regexpEscapePolyfill.js' },
    });
    expect(out).toBe([
      GENERATED_MARKER,
      '// Run `npm run sync:parser` to regenerate it; local changes will be overwritten.',
      `// Generated from https://github.com/EladHeller/wiki-bot@${'a'.repeat(40)}`,
      '// Original path: bot/wiki/newTemplateParser.ts',
      '// Source: wiki-bot (github.com/EladHeller), ISC license. See src/parser/CREDITS.md.',
      '',
      "import './regexpEscapePolyfill.js'; // local polyfill, see src/parser/CREDITS.md",
      '',
      "import { nextWikiText } from './WikiParser.js';",
      '',
      'export function find(text, name) {',
      '  return nextWikiText(text, 0, RegExp.escape(name));',
      '}',
      '',
    ].join('\n'));
  });

  test('is deterministic', () => {
    const source = "import { a } from './WikiParser';\nexport const b = (x: number): number => a(x);\n";
    expect(convertFile(source, ctx)).toBe(convertFile(source, ctx));
  });

  test('an import that leaves the whitelist fails the conversion', () => {
    const source = "import { logger } from '../utilities/logger';\nlogger.info('x');\n";
    expect(() => convertFile(source, ctx)).toThrow(/not in the sync whitelist/);
  });
});

describe('validateConfig', () => {
  const valid = {
    repo: 'https://github.com/EladHeller/wiki-bot.git',
    commit: 'b'.repeat(40),
    files: { 'bot/wiki/WikiParser.ts': 'src/parser/WikiParser.js' },
  };

  test('accepts a valid config and fills defaults', () => {
    expect(validateConfig(valid)).toEqual({
      ...valid, license: 'ISC', localFiles: [], polyfills: {},
    });
  });

  test.each([
    [{ ...valid, commit: 'abc' }, /40-character SHA/],
    [{ ...valid, repo: 'git@github.com:x/y' }, /https URL/],
    [{ ...valid, files: {} }, /"files"/],
    [{ ...valid, files: { 'bot/global.d.ts': 'src/parser/global.js' } }, /bad upstream path/],
    [{ ...valid, files: { 'bot/a.ts': '../outside.js' } }, /bad local path/],
    [{ ...valid, localFiles: ['src/parser/WikiParser.js'] }, /both as generated and as local/],
  ])('rejects invalid configs (%#)', (config, message) => {
    expect(() => validateConfig(config)).toThrow(message);
  });
});

describe('parseArgs', () => {
  test('parses --latest and --ref', () => {
    expect(parseArgs([])).toEqual({ latest: false, ref: undefined });
    expect(parseArgs(['--latest'])).toEqual({ latest: true, ref: undefined });
    expect(parseArgs(['--ref', 'master'])).toEqual({ latest: false, ref: 'master' });
    expect(parseArgs([`--ref=${'c'.repeat(40)}`])).toEqual({ latest: false, ref: 'c'.repeat(40) });
  });

  test.each([
    [['--ref']],
    [['--latest', '--ref', 'master']],
    [['--ref', 'abc1234']],
    [['--bogus']],
  ])('rejects %j', (argv) => {
    expect(() => parseArgs(argv)).toThrow(SyncError);
  });
});
