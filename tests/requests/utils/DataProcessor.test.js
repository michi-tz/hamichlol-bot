import { describe, test, expect } from '@jest/globals';
import { mapIdsToNames, mergeResults } from '../../../src/requests/utils/DataProcessor.js';

describe('mapIdsToNames', () => {
  test('re-keys an object using the given property of each value', () => {
    const input = {
      p1: { title: 'Alpha', pageid: 1 },
      p2: { title: 'Beta', pageid: 2 },
    };
    expect(mapIdsToNames(input, 'title')).toEqual({
      Alpha: { title: 'Alpha', pageid: 1 },
      Beta: { title: 'Beta', pageid: 2 },
    });
  });

  test('returns an empty object for an empty input object', () => {
    expect(mapIdsToNames({}, 'title')).toEqual({});
  });

  test('uses "undefined" as the key string when the key property is missing', () => {
    const input = { p1: { pageid: 1 } };
    const result = mapIdsToNames(input, 'title');
    expect(result).toEqual({ undefined: { pageid: 1 } });
  });

  test('later entries silently overwrite earlier ones on key collision', () => {
    // NOTE: documenting existing behavior - mapIdsToNames does not detect or
    // warn about collisions; it relies on Object.fromEntries's last-write-wins
    // semantics, so entries sharing the same `key` value collapse into one.
    const input = {
      p1: { title: 'Same', pageid: 1 },
      p2: { title: 'Same', pageid: 2 },
    };
    expect(mapIdsToNames(input, 'title')).toEqual({ Same: { title: 'Same', pageid: 2 } });
  });
});

describe('mergeResults', () => {
  test('returns existingResults unchanged when data has no query property', () => {
    const existing = { a: 1 };
    expect(mergeResults(existing, {})).toBe(existing);
  });

  describe('"pages" shaped responses', () => {
    test('merges pages into an empty existing result', () => {
      const data = { query: { pages: { 1: { pageid: 1, title: 'A' } } } };
      expect(mergeResults([], data)).toEqual({ 1: { pageid: 1, title: 'A' } });
    });

    test('deep merges pages sharing the same pageid, keeping the original value on scalar conflicts', () => {
      // NOTE: documenting existing behavior - on a plain-value conflict,
      // mergeDeep keeps the *first* object's value (val1), not the second
      // (newer) one. Here 'title' stays 'A' even though the new page data
      // has 'A2'.
      const existing = { 1: { pageid: 1, title: 'A', extra: 'x' } };
      const data = { query: { pages: { 1: { pageid: 1, title: 'A2' } } } };
      expect(mergeResults(existing, data)).toEqual({ 1: { pageid: 1, title: 'A', extra: 'x' } });
    });

    test('concatenates array-valued properties shared between merged pages', () => {
      const existing = { 1: { pageid: 1, categories: ['catA'] } };
      const data = { query: { pages: { 1: { pageid: 1, categories: ['catB'] } } } };
      expect(mergeResults(existing, data)).toEqual({ 1: { pageid: 1, categories: ['catA', 'catB'] } });
    });
  });

  describe('"querypage" shaped responses', () => {
    test('returns the new results when there are no existing results', () => {
      const data = { query: { querypage: { results: [{ title: 'A' }] } } };
      expect(mergeResults([], data)).toEqual([{ title: 'A' }]);
    });

    test('appends new results to an existing array', () => {
      const existing = [{ title: 'Old' }];
      const data = { query: { querypage: { results: [{ title: 'New' }] } } };
      expect(mergeResults(existing, data)).toEqual([{ title: 'Old' }, { title: 'New' }]);
    });

    test('deep merges into an existing object result set', () => {
      const existing = { existingKey: 'value' };
      const data = { query: { querypage: { results: [{ title: 'A' }] } } };
      expect(mergeResults(existing, data)).toEqual({ existingKey: 'value', results: [{ title: 'A' }] });
    });

    test('returns the new results when existingResults is an unexpected type', () => {
      const data = { query: { querypage: { results: [{ title: 'A' }] } } };
      expect(mergeResults('not-an-object-or-array', data)).toEqual([{ title: 'A' }]);
      expect(mergeResults(null, data)).toEqual([{ title: 'A' }]);
    });
  });

  describe('generic (fallback) query shapes', () => {
    test('concatenates the values of data.query onto an existing array', () => {
      const existing = ['x'];
      const data = { query: { foo: ['a', 'b'], bar: ['c'] } };
      expect(mergeResults(existing, data)).toEqual(['x', 'a', 'b', 'c']);
    });

    test('deep merges data.query into an existing object', () => {
      const existing = { a: 1 };
      const data = { query: { b: 2 } };
      expect(mergeResults(existing, data)).toEqual({ a: 1, b: 2 });
    });

    test('returns data.query unchanged when existingResults is an unexpected type', () => {
      const data = { query: { foo: 'bar' } };
      expect(mergeResults('weird', data)).toEqual({ foo: 'bar' });
      expect(mergeResults(undefined, data)).toEqual({ foo: 'bar' });
    });
  });
});
