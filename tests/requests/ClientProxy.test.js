import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

function makeFetchResponse({ json = {}, headers = {}, ok = true } = {}) {
  return {
    ok,
    status: ok ? 200 : 500,
    headers: {
      get: (key) => headers[key],
      raw: () => ({}),
    },
    json: async () => json,
  };
}

let fetchMock;
const SocksProxyAgentMock = jest.fn(function (url) {
  this.proxyUrl = url;
});

jest.unstable_mockModule('node-fetch', () => ({
  default: (...args) => fetchMock(...args),
}));

jest.unstable_mockModule('socks-proxy-agent', () => ({
  SocksProxyAgent: SocksProxyAgentMock,
}));

jest.unstable_mockModule('../../src/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const ENV_KEYS = ['MC_USER', 'MC_PASSWORD', 'MC_OAUTH_TOKEN', 'MC_CONFIG_PATH'];
let savedEnv;
let Client;

beforeEach(async () => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  jest.resetModules();
  SocksProxyAgentMock.mockClear();
  fetchMock = jest.fn();
  ({ default: Client } = await import('../../src/requests/Client.js'));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('WikiClient SOCKS proxy support', () => {
  const wikiUrl = 'https://example.org/api.php';

  test('creates a SOCKS proxy agent and passes it as `agent` to fetch', async () => {
    fetchMock.mockResolvedValueOnce(makeFetchResponse({ json: { query: {} } }));

    const client = new Client({
      wikiUrl,
      withLogedIn: false,
      proxyOptions: { type: 'socks', host: '127.0.0.1', port: 1080 },
    });

    expect(SocksProxyAgentMock).toHaveBeenCalledTimes(1);
    expect(SocksProxyAgentMock).toHaveBeenCalledWith('socks://127.0.0.1:1080');
    expect(client.proxyAgent).toBeInstanceOf(SocksProxyAgentMock);

    await client.wikiGet({ action: 'query' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.agent).toBe(client.proxyAgent);
  });

  test('passes the proxy agent on POST requests and token requests', async () => {
    fetchMock
      .mockResolvedValueOnce(makeFetchResponse({ json: { query: { tokens: { logintoken: 'lt' } } } }))
      .mockResolvedValueOnce(makeFetchResponse({ json: { login: { result: 'Success' } } }))
      .mockResolvedValueOnce(makeFetchResponse({ json: { query: { tokens: { csrftoken: 'ct' } } } }));

    const client = new Client({
      wikiUrl,
      proxyOptions: { type: 'socks', host: 'proxy.local', port: 9050 },
    });

    await expect(client.login('user', 'pass')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.agent).toBe(client.proxyAgent);
    }
  });

  test('supports proxyOptions via the deprecated positional constructor', () => {
    const client = new Client(wikiUrl, 5, 3, false, 'my-bot', {
      type: 'socks',
      host: '10.0.0.1',
      port: 1081,
    });

    expect(SocksProxyAgentMock).toHaveBeenCalledWith('socks://10.0.0.1:1081');
    expect(client.proxyAgent).toBeInstanceOf(SocksProxyAgentMock);
  });

  test('without proxyOptions no agent is created and `agent` is undefined', async () => {
    fetchMock.mockResolvedValueOnce(makeFetchResponse({ json: { query: {} } }));

    const client = new Client({ wikiUrl, withLogedIn: false });

    expect(SocksProxyAgentMock).not.toHaveBeenCalled();
    expect(client.proxyAgent).toBeNull();

    await client.wikiGet({ action: 'query' });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.agent).toBeUndefined();
  });
});
