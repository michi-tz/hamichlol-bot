import { describe, test, expect } from '@jest/globals';

/**
 * Dynamically imports `modulePath` and returns the error it rejects with.
 * Importing once (instead of once per assertion) avoids relying on how
 * Node/Jest cache a previously-rejected dynamic import across repeated calls
 * within the same test, which is not guaranteed to be consistent across
 * versions.
 *
 * Note on cross-test/cross-file caching: each test below imports a distinct
 * module path, so there is no in-file cache collision between tests. Jest
 * also gives every test *file* (not just every `test()`) its own isolated
 * module registry/VM context by default, so results here do not depend on
 * whether some other test file elsewhere in the suite also happens to import
 * one of these same broken modules.
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
 *
 * MAINTENANCE: these are "known bug" tests, not "intended behavior" tests.
 * Once the underlying bugs are actually fixed in src/parser/ (removing the
 * CommonJS syntax / fixing the bad import path / fixing the bad import
 * name), the corresponding `import(...)` calls below will start *resolving*
 * instead of rejecting, and these tests should be deleted (or rewritten to
 * assert the fixed, real behavior of the module) rather than left in place.
 */
describe('pre-existing CJS/ESM mismatch bugs in src/parser (documented, not fixed)', () => {
  // Each test below asserts only the version-independent facts that matter
  // for documenting the bug: the module fails to import, and rejects with
  // something that has a non-empty `.message`. The specific Node/Jest error
  // message text (e.g. "module is not defined", "require is not defined") is
  // deliberately not asserted on, and this suite avoids `toBeInstanceOf(Error)`
  // because Jest's ESM module realms can produce errors whose constructor
  // does not `instanceof`-match the test file's own `Error` global. See the
  // per-test comments below for the actual root cause of each failure.
  test('src/parser/utilities.js cannot be loaded: it uses `module.exports` inside an ES module', async () => {
    const error = await importAndCaptureError('../../src/parser/utilities.js');
    expect(error).toBeTruthy();
    expect(typeof error.message).toBe('string');
    expect(error.message.length).toBeGreaterThan(0);
  });

  test('src/parser/WikiDataSqlQueries.js cannot be loaded: it uses `module.exports` inside an ES module', async () => {
    const error = await importAndCaptureError('../../src/parser/WikiDataSqlQueries.js');
    expect(error).toBeTruthy();
    expect(typeof error.message).toBe('string');
    expect(error.message.length).toBeGreaterThan(0);
  });

  test('src/parser/wikiLinkParser.js cannot be loaded: it uses `require(...)` inside an ES module', async () => {
    // Unlike a plain `node` run (where `require` may be synthesized and
    // fails later on module resolution), inside this Jest ESM environment
    // `require` is simply undefined in module scope.
    const error = await importAndCaptureError('../../src/parser/wikiLinkParser.js');
    expect(error).toBeTruthy();
    expect(typeof error.message).toBe('string');
    expect(error.message.length).toBeGreaterThan(0);
  });

  test('src/parser/newTemplateParser.js cannot be loaded: it imports a non-existent named export "escapeRegex" from utilities.js', async () => {
    // utilities.js does not export an `escapeRegex` function at all (on top
    // of being unloadable itself, see above) - this is a second, independent
    // bug in the same import chain. Jest surfaces this as the dependent
    // module failing to resolve, rather than a specific "missing export"
    // message.
    const error = await importAndCaptureError('../../src/parser/newTemplateParser.js');
    expect(error).toBeTruthy();
    expect(typeof error.message).toBe('string');
    expect(error.message.length).toBeGreaterThan(0);
  });

  test('src/parser/paragraphParser.js cannot be loaded: it imports from the wrong relative path ("../utilities.js" instead of "./utilities.js")', async () => {
    // paragraphParser.js lives in src/parser/, so `../utilities.js` resolves
    // to the non-existent src/utilities.js instead of src/parser/utilities.js.
    const error = await importAndCaptureError('../../src/parser/paragraphParser.js');
    expect(error).toBeTruthy();
    expect(typeof error.message).toBe('string');
    expect(error.message.length).toBeGreaterThan(0);
  });
});
