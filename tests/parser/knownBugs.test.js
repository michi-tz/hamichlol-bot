import { describe, test, expect } from '@jest/globals';

/**
 * This suite does not test functionality - it documents a pre-existing,
 * repository-wide bug cluster affecting several modules under src/parser/.
 *
 * The package is declared as `"type": "module"` in package.json, so every
 * `.js` file (without a `.cjs` override) is parsed as a native ES module.
 * A handful of files under src/parser/ were nonetheless written using
 * CommonJS syntax (`require(...)` / `module.exports = ...`), which is not
 * valid inside an ES module and causes them - and anything that statically
 * imports them - to fail to load, both when run directly with Node and when
 * imported inside this Jest test environment (which also runs test files as
 * real ES modules, per `node --experimental-vm-modules` in the `test`
 * script).
 *
 * Per the task instructions, existing source code is intentionally left
 * unmodified; these tests only document the current, broken behavior using
 * dynamic `import()` (a static `import` of these modules would crash the
 * whole test file instead of producing a normal, isolated test failure).
 */
describe('pre-existing CJS/ESM mismatch bugs in src/parser (documented, not fixed)', () => {
  // NOTE: the specific error message substrings asserted below (captured at
  // the time this suite was written, against the Node/Jest versions in this
  // repo's lockfile) are a secondary, "nice to have" check illustrating the
  // *root cause* of each failure. The primary assertion in every test is
  // simply that the dynamic `import()` rejects at all - that's the actual
  // bug being documented, and it does not depend on exact wording that could
  // change across Node.js/Jest releases.
  test('src/parser/utilities.js cannot be loaded: it uses `module.exports` inside an ES module', async () => {
    await expect(import('../../src/parser/utilities.js')).rejects.toThrow();
    await expect(import('../../src/parser/utilities.js')).rejects.toThrow(
      /module is not defined/
    );
  });

  test('src/parser/WikiDataSqlQueries.js cannot be loaded: it uses `module.exports` inside an ES module', async () => {
    await expect(import('../../src/parser/WikiDataSqlQueries.js')).rejects.toThrow();
    await expect(import('../../src/parser/WikiDataSqlQueries.js')).rejects.toThrow(
      /module is not defined/
    );
  });

  test('src/parser/wikiLinkParser.js cannot be loaded: it uses `require(...)` inside an ES module', async () => {
    // Unlike a plain `node` run (where `require` may be synthesized and
    // fails later on module resolution), inside this Jest ESM environment
    // `require` is simply undefined in module scope.
    await expect(import('../../src/parser/wikiLinkParser.js')).rejects.toThrow();
    await expect(import('../../src/parser/wikiLinkParser.js')).rejects.toThrow(
      /require is not defined/
    );
  });

  test('src/parser/newTemplateParser.js cannot be loaded: it imports a non-existent named export "escapeRegex" from utilities.js', async () => {
    // utilities.js does not export an `escapeRegex` function at all (on top
    // of being unloadable itself, see above) - this is a second, independent
    // bug in the same import chain. Jest surfaces this as the dependent
    // module failing to resolve, rather than a specific "missing export"
    // message.
    await expect(import('../../src/parser/newTemplateParser.js')).rejects.toThrow();
    await expect(import('../../src/parser/newTemplateParser.js')).rejects.toThrow(
      /resolved to an errored module/
    );
  });

  test('src/parser/paragraphParser.js cannot be loaded: it imports from the wrong relative path ("../utilities.js" instead of "./utilities.js")', async () => {
    // paragraphParser.js lives in src/parser/, so `../utilities.js` resolves
    // to the non-existent src/utilities.js instead of src/parser/utilities.js.
    await expect(import('../../src/parser/paragraphParser.js')).rejects.toThrow();
    await expect(import('../../src/parser/paragraphParser.js')).rejects.toThrow(
      /Cannot find module|Cannot find package/
    );
  });
});
