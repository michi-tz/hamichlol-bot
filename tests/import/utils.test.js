import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// applyReplacements fetches "default replacements" over the network via
// getRequestsInstance(...).parse(...). Mocking that module keeps these tests
// fast, deterministic and offline, without touching the source.
jest.unstable_mockModule('../../src/requests/requests.js', () => ({
  getRequestsInstance: jest.fn(),
}));
jest.unstable_mockModule('../../src/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { getRequestsInstance } = await import('../../src/requests/requests.js');
const { default: logger } = await import('../../src/logger.js');
const { getProperties, applyReplacements } = await import('../../src/import/utils.js');

describe('getProperties', () => {
  test('returns an empty string when properties is null/undefined', () => {
    expect(getProperties(null, 'wikibase_item')).toBe('');
    expect(getProperties(undefined, 'wikibase_item')).toBe('');
  });

  test('returns an empty string when properties is an empty array', () => {
    expect(getProperties([], 'wikibase_item')).toBe('');
  });

  test('returns the "*" value of the matching property', () => {
    const properties = [
      { name: 'defaultsort', '*': 'Smith, John' },
      { name: 'wikibase_item', '*': 'Q12345' },
    ];
    expect(getProperties(properties, 'wikibase_item')).toBe('Q12345');
  });

  test('returns an empty string when no property matches the requested type', () => {
    const properties = [{ name: 'defaultsort', '*': 'Smith, John' }];
    expect(getProperties(properties, 'wikibase_item')).toBe('');
  });

  test('matches using loose equality (==) for the property name', () => {
    // NOTE: documenting existing behavior - getProperties compares
    // `property.name == type` (not `===`), so type coercion applies here.
    const properties = [{ name: 1, '*': 'coerced-match' }];
    expect(getProperties(properties, '1')).toBe('coerced-match');
  });
});

describe('applyReplacements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('applies a remotely-fetched default replacement to the text', async () => {
    getRequestsInstance.mockReturnValue({
      parse: jest.fn().mockResolvedValue({
        parse: { wikitext: { '*': JSON.stringify([{ from: 'foo', to: 'bar' }]) } },
      }),
    });

    const result = await applyReplacements('foo text');

    expect(result).toEqual({ text: 'bar text', hasReplacements: true });
  });

  test('applies caller-provided replacements in addition to remote ones', async () => {
    getRequestsInstance.mockReturnValue({
      parse: jest.fn().mockResolvedValue({
        parse: { wikitext: { '*': JSON.stringify([]) } },
      }),
    });

    const result = await applyReplacements('foo text', [{ from: 'text', to: 'TXT' }]);

    expect(result).toEqual({ text: 'foo TXT', hasReplacements: true });
  });

  test('reports hasReplacements=false when nothing matches', async () => {
    getRequestsInstance.mockReturnValue({
      parse: jest.fn().mockResolvedValue({
        parse: { wikitext: { '*': JSON.stringify([]) } },
      }),
    });

    const result = await applyReplacements('unrelated text', [{ from: 'nomatch', to: 'x' }]);

    expect(result).toEqual({ text: 'unrelated text', hasReplacements: false });
  });

  test('is case-insensitive, per the "gi" regex flags used internally', async () => {
    getRequestsInstance.mockReturnValue({
      parse: jest.fn().mockResolvedValue({
        parse: { wikitext: { '*': JSON.stringify([]) } },
      }),
    });

    const result = await applyReplacements('FOO text', [{ from: 'foo', to: 'bar' }]);

    expect(result).toEqual({ text: 'bar text', hasReplacements: true });
  });

  test('falls back to only the caller-provided replacements when the remote fetch response has no parse result', async () => {
    getRequestsInstance.mockReturnValue({
      parse: jest.fn().mockResolvedValue({}), // no `parse` property in the response
    });

    const result = await applyReplacements('foo text', [{ from: 'foo', to: 'bar' }]);

    expect(result).toEqual({ text: 'bar text', hasReplacements: true });
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to fetch default replacements: parse not found'
    );
  });

  test('falls back to only the caller-provided replacements when the remote fetch itself rejects', async () => {
    getRequestsInstance.mockReturnValue({
      parse: jest.fn().mockRejectedValue(new Error('network down')),
    });

    const result = await applyReplacements('foo text', [{ from: 'foo', to: 'bar' }]);

    expect(result).toEqual({ text: 'bar text', hasReplacements: true });
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to fetch default replacements:',
      expect.any(Error)
    );
  });

  test('returns the original text unchanged and hasReplacements=false with no replacements at all', async () => {
    getRequestsInstance.mockReturnValue({
      parse: jest.fn().mockResolvedValue({
        parse: { wikitext: { '*': JSON.stringify([]) } },
      }),
    });

    const result = await applyReplacements('plain text');

    expect(result).toEqual({ text: 'plain text', hasReplacements: false });
  });
});
