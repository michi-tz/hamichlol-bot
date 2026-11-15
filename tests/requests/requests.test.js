import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Requests -> WikiClient ultimately calls the real network via node-fetch;
// mock it (and the shared logger) so these tests run fully offline.
jest.unstable_mockModule('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.unstable_mockModule('../../src/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { default: fetch } = await import('node-fetch');
const { Requests, getRequestsInstance } = await import('../../src/requests/requests.js');

function jsonResponse(body, overrides = {}) {
  return {
    ok: true,
    headers: { raw: () => ({}), get: () => null },
    json: async () => body,
    ...overrides,
  };
}

describe('Requests constructor', () => {
  test('throws when no wikiUrl is provided (options object form)', () => {
    expect(() => new Requests({})).toThrow("you didn't pass the url of your wiki");
  });

  test('throws when constructed with no arguments at all', () => {
    expect(() => new Requests()).toThrow("you didn't pass the url of your wiki");
  });

  test('supports the deprecated string-first constructor signature', () => {
    const r = new Requests('https://example.org/w/api.php');
    expect(r.wikiUrl).toBe('https://example.org/w/api.php');
  });

  test('supports the options-object constructor signature', () => {
    const r = new Requests({ wikiUrl: 'https://example.org/w/api.php' });
    expect(r.wikiUrl).toBe('https://example.org/w/api.php');
  });
});

describe('Requests query methods (network-isolated)', () => {
  let r;

  beforeEach(() => {
    jest.clearAllMocks();
    r = new Requests({ wikiUrl: 'https://example.org/w/api.php', withLogedIn: false });
  });

  describe('queryPages', () => {
    test('returns the raw query result when useIdsOrTitles is "ids" (default)', async () => {
      fetch.mockResolvedValue(
        jsonResponse({ query: { pages: { 1: { pageid: 1, title: 'Alpha' } } } })
      );
      const result = await r.queryPages({ titles: 'Alpha' });
      expect(result).toEqual({ 1: { pageid: 1, title: 'Alpha' } });
    });

    test('maps ids to titles when useIdsOrTitles is "titles"', async () => {
      fetch.mockResolvedValue(
        jsonResponse({ query: { pages: { 1: { pageid: 1, title: 'Alpha' } } } })
      );
      const result = await r.queryPages({ titles: 'Alpha', useIdsOrTitles: 'titles' });
      expect(result).toEqual({ Alpha: { pageid: 1, title: 'Alpha' } });
    });

    test('joins an array of titles with "|"', async () => {
      fetch.mockResolvedValue(jsonResponse({ query: { pages: {} } }));
      await r.queryPages({ titles: ['Alpha', 'Beta'] });
      const [, requestOptions] = fetch.mock.calls[0];
      expect(requestOptions.body.get('titles')).toBe('Alpha|Beta');
    });

    // NOTE: documenting existing behavior - `query`'s internal branch only
    // switches to a real HTTP GET when `method === "Get"` (capital G only).
    // The public methods (queryPages, embeddedin, ...) either don't forward a
    // `method` at all or default it to "GET" (all caps), so in practice every
    // request built through this class is sent as an HTTP POST, even for
    // read-only queries. This looks like a typo bug, but it's left
    // unmodified here per the task instructions.
    test('always issues an HTTP POST in practice, due to the "Get" (not "GET") method check', async () => {
      fetch.mockResolvedValue(jsonResponse({ query: { pages: {} } }));
      await r.queryPages({ titles: 'Alpha' });
      const [, requestOptions] = fetch.mock.calls[0];
      expect(requestOptions.method).toBe('POST');
    });
  });

  describe('embeddedin', () => {
    test('throws when neither pageid nor title is provided', async () => {
      await expect(r.embeddedin({})).rejects.toThrow('you must provide either pageid or title');
    });

    test('throws when both pageid and title are provided', async () => {
      await expect(r.embeddedin({ pageid: 1, title: 'X' })).rejects.toThrow(
        'you must provide either pageid or title'
      );
    });

    test('queries by pageid', async () => {
      fetch.mockResolvedValue(jsonResponse({ query: { embeddedin: [] } }));
      await r.embeddedin({ pageid: 42 });
      const [, requestOptions] = fetch.mock.calls[0];
      expect(requestOptions.body.get('einpageid')).toBe('42');
    });

    test('queries by title', async () => {
      fetch.mockResolvedValue(jsonResponse({ query: { embeddedin: [] } }));
      await r.embeddedin({ title: 'Template:X' });
      const [, requestOptions] = fetch.mock.calls[0];
      expect(requestOptions.body.get('eititle')).toBe('Template:X');
    });
  });

  describe('categoryMembers', () => {
    test('throws when both categoryId and categoryName are provided', async () => {
      await expect(
        r.categoryMembers({ categoryId: 1, categoryName: 'Foo' })
      ).rejects.toThrow('you must provide either categoryId or categoryName');
    });

    test('prefixes categoryName with the Hebrew category namespace', async () => {
      fetch.mockResolvedValue(jsonResponse({ query: { categorymembers: [] } }));
      await r.categoryMembers({ categoryName: 'דוגמה' });
      const [, requestOptions] = fetch.mock.calls[0];
      expect(requestOptions.body.get('cmtitle')).toBe('קטגוריה:דוגמה');
    });

    test('uses categoryId (cmpageid) when provided', async () => {
      fetch.mockResolvedValue(jsonResponse({ query: { categorymembers: [] } }));
      await r.categoryMembers({ categoryId: 7 });
      const [, requestOptions] = fetch.mock.calls[0];
      expect(requestOptions.body.get('cmpageid')).toBe('7');
    });
  });

  describe('parse', () => {
    test('throws when neither page nor pageid is provided', async () => {
      await expect(r.parse({})).rejects.toThrow('you must pass either page or pageid');
    });

    test('throws when both page and pageid are provided', async () => {
      await expect(r.parse({ page: 'A', pageid: 1 })).rejects.toThrow(
        "you can't pass both page and pageid"
      );
    });

    test('defaults prop to "wikitext"', async () => {
      fetch.mockResolvedValue(jsonResponse({ parse: { wikitext: { '*': 'text' } } }));
      await r.parse({ page: 'A' });
      const [url] = fetch.mock.calls[0];
      expect(url.searchParams.get('prop')).toBe('wikitext');
    });

    test('includes section 0 (falsy but explicit) in the request', async () => {
      fetch.mockResolvedValue(jsonResponse({ parse: {} }));
      await r.parse({ page: 'A', section: 0 });
      const [url] = fetch.mock.calls[0];
      expect(url.searchParams.get('section')).toBe('0');
    });
  });

  describe('getWithContinue', () => {
    test('throws "data or query is not valid" when data has no query', async () => {
      await expect(r.getWithContinue({}, null)).rejects.toThrow('data or query is not valid');
      await expect(r.getWithContinue({}, {})).rejects.toThrow('data or query is not valid');
    });

    test('throws when queryParams is falsy', async () => {
      await expect(r.getWithContinue(null, { query: {} })).rejects.toThrow(
        'the query params in getWithContinue is not valid'
      );
    });

    test('follows "continue" tokens across multiple pages and merges results', async () => {
      let call = 0;
      fetch.mockImplementation(async () => {
        call += 1;
        if (call === 1) {
          return jsonResponse({
            query: { pages: { 1: { pageid: 1, title: 'A' } } },
            continue: { cont: 'token' },
          });
        }
        return jsonResponse({ query: { pages: { 2: { pageid: 2, title: 'B' } } } });
      });

      const result = await r.query({ options: {} });

      expect(call).toBe(2);
      expect(result).toEqual({
        1: { pageid: 1, title: 'A' },
        2: { pageid: 2, title: 'B' },
      });
    });

    test('does not paginate when getContinue is false', async () => {
      fetch.mockResolvedValue(
        jsonResponse({ query: { pages: { 1: { pageid: 1 } } }, continue: { cont: 'token' } })
      );
      const result = await r.query({ options: {}, getContinue: false });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ query: { pages: { 1: { pageid: 1 } } }, continue: { cont: 'token' } });
    });
  });
});

describe('getRequestsInstance', () => {
  test('returns the same cached instance for the same name', () => {
    const first = getRequestsInstance('hamichlol');
    const second = getRequestsInstance('hamichlol');
    expect(first).toBe(second);
  });

  test('defaults to the hamichlol wiki API URL', () => {
    const instance = getRequestsInstance('hamichlol');
    expect(instance.wikiUrl).toBe('https://www.hamichlol.org.il/w/api.php');
  });

  test('uses an explicitly provided wikiUrl over the default', () => {
    const instance = getRequestsInstance('custom-name', 'https://custom.example/api.php');
    expect(instance.wikiUrl).toBe('https://custom.example/api.php');
  });
});
