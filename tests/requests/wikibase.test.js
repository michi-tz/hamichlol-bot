import { jest, describe, test, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.unstable_mockModule('../../src/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { default: fetch } = await import('node-fetch');
const { default: WikiBase } = await import('../../src/requests/wikibase.js');

function jsonResponse(body) {
  return {
    ok: true,
    headers: { raw: () => ({}), get: () => null },
    json: async () => body,
  };
}

describe('WikiBase', () => {
  let wb;

  beforeEach(() => {
    jest.clearAllMocks();
    wb = new WikiBase('https://www.wikidata.org/w/api.php');
    // Bypass the login flow for these isolated unit tests.
    wb.isLoggedIn = true;
  });

  test('is constructed without auto-login (withLogedIn=false via the deprecated string constructor)', () => {
    expect(wb.withLogedIn).toBe(false);
    expect(wb.maxlag).toBe(5);
    expect(wb.maxRetries).toBe(3);
  });

  describe('getClaims', () => {
    test('sends the correct base params', async () => {
      fetch.mockResolvedValue(jsonResponse({ claims: {} }));
      await wb.getClaims('Q42', {});
      const [url] = fetch.mock.calls[0];
      expect(url.searchParams.get('action')).toBe('wbgetclaims');
      expect(url.searchParams.get('entity')).toBe('Q42');
    });

    test('includes an optional property filter', async () => {
      fetch.mockResolvedValue(jsonResponse({ claims: {} }));
      await wb.getClaims('Q42', { property: 'P31' });
      const [url] = fetch.mock.calls[0];
      expect(url.searchParams.get('property')).toBe('P31');
    });

    test('includes an optional rank filter (note: the "rnak" typo in the source is preserved)', async () => {
      fetch.mockResolvedValue(jsonResponse({ claims: {} }));
      await wb.getClaims('Q42', { rnak: 'normal' });
      const [url] = fetch.mock.calls[0];
      expect(url.searchParams.get('rnak')).toBe('normal');
    });
  });

  describe('getEntities', () => {
    test('applies default sites/languages', async () => {
      fetch.mockResolvedValue(jsonResponse({ entities: {} }));
      await wb.getEntities('Title');
      const [url] = fetch.mock.calls[0];
      expect(url.searchParams.get('sites')).toBe('hewiki');
      expect(url.searchParams.get('languages')).toBe('he');
      expect(url.searchParams.get('titles')).toBe('Title');
    });

    test('allows overriding sites and languages', async () => {
      fetch.mockResolvedValue(jsonResponse({ entities: {} }));
      await wb.getEntities('Title', 'enwiki', 'en');
      const [url] = fetch.mock.calls[0];
      expect(url.searchParams.get('sites')).toBe('enwiki');
      expect(url.searchParams.get('languages')).toBe('en');
    });
  });

  describe('formatValue', () => {
    test('JSON-stringifies the value and includes the type', async () => {
      fetch.mockResolvedValue(jsonResponse({ result: '<span>42</span>' }));
      wb.token = { csrftoken: 'tok' };
      await wb.formatValue({ amount: '+42' }, 'quantity');
      const [, requestOptions] = fetch.mock.calls[0];
      expect(requestOptions.body.get('value')).toBe(JSON.stringify({ amount: '+42' }));
      expect(requestOptions.body.get('type')).toBe('quantity');
      expect(requestOptions.method).toBe('POST');
    });
  });
});
