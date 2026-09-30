import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import MemoryCache from '../../../src/requests/utils/MemoryCache.js';

describe('MemoryCache', () => {
  describe('constructor / defaults', () => {
    test('uses default options when none are passed', () => {
      const cache = new MemoryCache();
      expect(cache.options).toEqual({ enabled: true, ttl: 3600000, maxSize: 1000 });
      expect(cache.cache.size).toBe(0);
      expect(cache.stats).toEqual({ hits: 0, misses: 0, size: 0 });
    });

    test('merges partial options with defaults', () => {
      const cache = new MemoryCache({ ttl: 1000 });
      expect(cache.options).toEqual({ enabled: true, ttl: 1000, maxSize: 1000 });
    });

    test('allows overriding all options', () => {
      const cache = new MemoryCache({ enabled: false, ttl: 5, maxSize: 2 });
      expect(cache.options).toEqual({ enabled: false, ttl: 5, maxSize: 2 });
    });
  });

  describe('makeKey', () => {
    test('builds a deterministic key from method and params', () => {
      const cache = new MemoryCache();
      expect(cache.makeKey('query', { a: 1 })).toBe('query:{"a":1}');
    });

    test('produces different keys for different params', () => {
      const cache = new MemoryCache();
      expect(cache.makeKey('query', { a: 1 })).not.toBe(cache.makeKey('query', { a: 2 }));
    });
  });

  describe('get / set happy path', () => {
    test('returns null for a cache miss', () => {
      const cache = new MemoryCache();
      expect(cache.get('query', { a: 1 })).toBeNull();
    });

    test('returns the stored value for a cache hit and increments hits', () => {
      const cache = new MemoryCache();
      cache.set('query', { a: 1 }, { result: 42 });
      expect(cache.get('query', { a: 1 })).toEqual({ result: 42 });
      expect(cache.stats.hits).toBe(1);
    });

    test('treats different params as different cache entries', () => {
      const cache = new MemoryCache();
      cache.set('query', { a: 1 }, 'first');
      cache.set('query', { a: 2 }, 'second');
      expect(cache.get('query', { a: 1 })).toBe('first');
      expect(cache.get('query', { a: 2 })).toBe('second');
    });
  });

  describe('disabled cache', () => {
    test('get always returns null when disabled', () => {
      const cache = new MemoryCache({ enabled: false });
      cache.set('query', {}, 'value');
      expect(cache.get('query', {})).toBeNull();
    });

    test('set is a no-op when disabled', () => {
      const cache = new MemoryCache({ enabled: false });
      cache.set('query', {}, 'value');
      expect(cache.cache.size).toBe(0);
    });
  });

  describe('expiry handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('returns null and evicts the entry once the ttl has elapsed', () => {
      const cache = new MemoryCache({ ttl: 1000 });
      cache.set('query', {}, 'value');
      expect(cache.get('query', {})).toBe('value');

      jest.advanceTimersByTime(1001);

      expect(cache.get('query', {})).toBeNull();
      expect(cache.cache.size).toBe(0);
    });

    test('still returns the value just before expiry', () => {
      const cache = new MemoryCache({ ttl: 1000 });
      cache.set('query', {}, 'value');
      jest.advanceTimersByTime(999);
      expect(cache.get('query', {})).toBe('value');
    });
  });

  describe('maxSize eviction', () => {
    test('evicts the oldest entry once maxSize is reached', () => {
      const cache = new MemoryCache({ maxSize: 2 });
      cache.set('m', { id: 1 }, 'one');
      cache.set('m', { id: 2 }, 'two');
      // Cache is now full (size 2); adding a third entry must evict the first.
      cache.set('m', { id: 3 }, 'three');

      expect(cache.cache.size).toBe(2);
      expect(cache.get('m', { id: 1 })).toBeNull();
      expect(cache.get('m', { id: 2 })).toBe('two');
      expect(cache.get('m', { id: 3 })).toBe('three');
    });
  });

  describe('clear', () => {
    test('clears the entire cache when called without arguments', () => {
      const cache = new MemoryCache();
      cache.set('a', {}, 1);
      cache.set('b', {}, 2);
      cache.clear();
      expect(cache.cache.size).toBe(0);
      expect(cache.stats.size).toBe(0);
    });

    test('clears only entries for a given method when params are omitted', () => {
      const cache = new MemoryCache();
      cache.set('a', { id: 1 }, 1);
      cache.set('a', { id: 2 }, 2);
      cache.set('b', { id: 1 }, 3);

      cache.clear('a');

      expect(cache.get('a', { id: 1 })).toBeNull();
      expect(cache.get('a', { id: 2 })).toBeNull();
      expect(cache.get('b', { id: 1 })).toBe(3);
    });

    test('clears a single entry when both method and params are given', () => {
      const cache = new MemoryCache();
      cache.set('a', { id: 1 }, 1);
      cache.set('a', { id: 2 }, 2);

      cache.clear('a', { id: 1 });

      expect(cache.get('a', { id: 1 })).toBeNull();
      expect(cache.get('a', { id: 2 })).toBe(2);
    });
  });

  describe('getStats / registerMiss', () => {
    test('reports hitRate of 0 when there is no traffic', () => {
      const cache = new MemoryCache();
      expect(cache.getStats()).toEqual({ hits: 0, misses: 0, size: 0, hitRate: 0 });
    });

    test('computes hitRate from recorded hits and misses', () => {
      const cache = new MemoryCache();
      cache.set('a', {}, 1);
      cache.get('a', {}); // hit
      cache.registerMiss();
      cache.registerMiss();

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(1 / 3);
    });
  });
});
