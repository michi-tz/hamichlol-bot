import { describe, test, expect } from '@jest/globals';

// utilities.js and newTemplateParser.js used to be part of the bug cluster
// in knownBugs.test.js; they are fixed on this branch, so they are asserted to load instead.
describe('src/parser modules that load correctly', () => {
  test('src/parser/utilities.js loads and exports escapeRegex', async () => {
    const utilities = await import('../../src/parser/utilities.js');
    expect(typeof utilities.escapeRegex).toBe('function');
  });

  test('src/parser/newTemplateParser.js loads and exports its template helpers', async () => {
    const parser = await import('../../src/parser/newTemplateParser.js');
    expect(typeof parser.findTemplates).toBe('function');
    expect(typeof parser.getTemplateKeyValueData).toBe('function');
  });
});
