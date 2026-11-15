# CREDITS

## עברית

הקוד בתיקייה זו נלקח ממאגר הקוד הפתוח
[EladHeller/wiki-bot](https://github.com/EladHeller/wiki-bot), המופץ ברישיון **ISC**
(לפי שדה `license` בקובץ `package.json` של המאגר). כל הזכויות על הקוד המקורי שמורות לכותביו.

הקבצים שמתחילים ב-`// GENERATED FILE` נוצרים אוטומטית מקובצי ה-TypeScript של המאגר המקורי,
לפי ה-commit הנעוץ בקובץ `upstream.json`, ואין לערוך אותם ידנית. כדי לעדכן אותם מריצים
`npm run sync:parser` (או `npm run sync:parser -- --latest` כדי לעבור ל-commit האחרון).
הקבצים שמתחילים ב-`// LOCAL FILE` מתוחזקים כאן. ראו את הפירוט באנגלית למטה.

## English

The code in this directory comes from the open-source repository
[EladHeller/wiki-bot](https://github.com/EladHeller/wiki-bot), licensed under **ISC** (per the
`license` field of its `package.json`; the repository has no separate LICENSE file). Copyright of the
original code remains with its authors.

### How syncing works

- `upstream.json` records the upstream repository URL, the pinned commit SHA and the mapping of
  upstream files to local files.
- `npm run sync:parser` (`scripts/sync-parser.mjs`) shallow-fetches the pinned commit with git into a
  temporary directory, reads the mapped files from git (nothing from upstream is checked out, installed
  or run), converts them and rewrites the local files. `-- --latest` moves the pin to upstream's
  default-branch head first; `-- --ref <full sha|branch|tag>` moves it to a given ref.
- Conversion only erases TypeScript type syntax (annotations, interfaces, type aliases, type-only
  imports, generics, `as`/`!`/`satisfies`); formatting and comments stay as upstream wrote them.
  Every result is checked against `ts.transpileModule` and must be valid JavaScript, otherwise the sync
  fails without writing anything. Relative imports get a `.js` extension. An import of anything not
  listed in `upstream.json` (another upstream file or a package) fails the sync, so a new upstream
  dependency is noticed instead of silently breaking.
- The weekly workflow `.github/workflows/sync-parser.yml` runs the `--latest` sync and opens a pull
  request when anything changed.

### Generated files (do not edit; header `// GENERATED FILE`)

| Local file | Upstream file |
| --- | --- |
| `WikiParser.js` | `bot/wiki/WikiParser.ts` |
| `newTemplateParser.js` | `bot/wiki/newTemplateParser.ts` |
| `paragraphParser.js` | `bot/wiki/paragraphParser.ts` |
| `wikiLinkParser.js` | `bot/wiki/wikiLinkParser.ts` |
| `wikiTableParser.js` | `bot/wiki/wikiTableParser.ts` |
| `redirectParser.js` | `bot/wiki/redirectParser.ts` |
| `utilities.js` | `bot/utilities.ts` (self-contained once types are erased; none of the parser files import it) |

### Local files (maintained here; header `// LOCAL FILE`)

- `WikiDataSqlQueries.js` - Wikidata SPARQL query helpers adapted from an older version of
  `bot/wiki/WikiDataSqlQueries.ts`, which is empty upstream now.
- `regexpEscapePolyfill.js` - polyfill for `RegExp.escape` (ES2025, native only from Node.js 24), which
  upstream uses. The sync adds `import './regexpEscapePolyfill.js';` to generated files that use it
  ("polyfills" in `upstream.json`).
- `upstream.json` and this file.
