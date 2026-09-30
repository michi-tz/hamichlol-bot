import { describe, test, expect } from '@jest/globals';

/**
 * Dynamically imports `modulePath` and returns the error it rejects with.
 * Importing once (instead of once per assertion) avoids relying on how
 * Node/Jest cache a previously-rejected dynamic import across repeated calls,
 * which is not guaranteed to be consistent across versions.
 */
async function importAndCaptureError(modulePath) {
  try {
    await import(modulePath);
  } catch (error) {
    return error;
  }
  throw new Error(`Expected import('${modulePath}') to reject, but it resolved.`);
}

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
  // repo's lockfile) illustrate the *root cause* of each failure but could,
  // in principle, change wording across Node.js/Jest releases. The
  // `importAndCaptureError` helper above guarantees each module is only
  // imported once per test, so both the "it rejects" fact and the message
  // content are asserted against the exact same captured error.
  test('src/parser/utilities.js cannot be loaded: it uses `module.exports` inside an ES module', async () => {
    const error = await importAndCaptureError('../../src/parser/utilities.js');
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/module is not defined/);
  });

  test('src/parser/WikiDataSqlQueries.js cannot be loaded: it uses `module.exports` inside an ES module', async () => {
    const error = await importAndCaptureError('../../src/parser/WikiDataSqlQueries.js');
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/module is not defined/);
  });

  test('src/parser/wikiLinkParser.js cannot be loaded: it uses `require(...)` inside an ES module', async () => {
    // Unlike a plain `node` run (where `require` may be synthesized and
    // fails later on module resolution), inside this Jest ESM environment
    // `require` is simply undefined in module scope.
    const error = await importAndCaptureError('../../src/parser/wikiLinkParser.js');
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/require is not defined/);
  });

  test('src/parser/newTemplateParser.js cannot be loaded: it imports a non-existent named export "escapeRegex" from utilities.js', async () => {
    // utilities.js does not export an `escapeRegex` function at all (on top
    // of being unloadable itself, see above) - this is a second, independent
    // bug in the same import chain. Jest surfaces this as the dependent
    // module failing to resolve, rather than a specific "missing export"
    // message.
    const error = await importAndCaptureError('../../src/parser/newTemplateParser.js');
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/resolved to an errored module/);
  });

  test('src/parser/paragraphParser.js cannot be loaded: it imports from the wrong relative path ("../utilities.js" instead of "./utilities.js")', async () => {
    // paragraphParser.js lives in src/parser/, so `../utilities.js` resolves
    // to the non-existent src/utilities.js instead of src/parser/utilities.js.
    const error = await importAndCaptureError('../../src/parser/paragraphParser.js');
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/Cannot find module|Cannot find package/);
  });
});
