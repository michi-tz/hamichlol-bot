import fs from 'fs';
import os from 'os';
import path from 'path';
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

jest.unstable_mockModule('node-fetch', () => ({
  default: (...args) => fetchMock(...args),
}));

jest.unstable_mockModule('../../src/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

let Client;
let logger;

beforeEach(async () => {
  jest.resetModules();
  fetchMock = jest.fn();
  ({ default: Client } = await import('../../src/requests/Client.js'));
  ({ default: logger } = await import('../../src/logger.js'));
});

describe('WikiClient OAuth authentication', () => {
  test('constructor accepts oauthToken and marks the client as logged in without calling login', () => {
    const client = new Client({
      wikiUrl: 'https://example.org/api.php',
      oauthToken: 'my-secret-token',
    });

    expect(client.isLoggedIn).toBe(true);
  });

  test('sends an auth header on GET requests', async () => {
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({ json: { query: { pages: {} } } })
    );

    const client = new Client({
      wikiUrl: 'https://example.org/api.php',
      oauthToken: 'abc123',
    });

    await client.wikiGet({ action: 'query' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe(['Bearer', 'abc123'].join(' '));
  });

  test('sends an auth header on POST requests', async () => {
    fetchMock.mockResolvedValueOnce(makeFetchResponse({ json: { edit: {} } }));

    const client = new Client({
      wikiUrl: 'https://example.org/api.php',
      oauthToken: 'abc123',
    });

    await client.wikiPost({ action: 'edit' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe(['Bearer', 'abc123'].join(' '));
    expect(options.method).toBe('POST');
  });

  test('sends an auth header when fetching a token', async () => {
    const client = new Client({
      wikiUrl: 'https://example.org/api.php',
      oauthToken: 'abc123',
    });

    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({ json: { query: { tokens: { rollbacktoken: 'rbtok' } } } })
    );
    fetchMock.mockResolvedValueOnce(makeFetchResponse({ json: { rollback: {} } }));

    await client.rollback('someUser', { title: 'Test' });

    const tokenCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('meta=tokens')
    );
    expect(tokenCall).toBeDefined();
    const [, tokenOptions] = tokenCall;
    expect(tokenOptions.headers.Authorization).toBe(['Bearer', 'abc123'].join(' '));
  });

  test('does not send an action=login request when using OAuth', async () => {
    fetchMock.mockResolvedValue(
      makeFetchResponse({ json: { query: { tokens: { csrftoken: 'tok' } } } })
    );

    const client = new Client({
      wikiUrl: 'https://example.org/api.php',
      oauthToken: 'abc123',
    });

    await client.wikiGet({ action: 'query' });

    for (const call of fetchMock.mock.calls) {
      const url = String(call[0]);
      const body = call[1]?.body ? String(call[1].body) : '';
      expect(url.includes('action=login')).toBe(false);
      expect(body.includes('action=login')).toBe(false);
    }
  });

  test('prefers OAuth over username/password when both are provided and logs a message', () => {
    const client = new Client({
      wikiUrl: 'https://example.org/api.php',
      oauthToken: 'abc123',
      userName: 'someUser',
      password: 'somePassword',
    });

    expect(client.isLoggedIn).toBe(true);
    expect(logger.info).toHaveBeenCalled();
  });

  test('never logs the raw oauth token value', () => {
    new Client({
      wikiUrl: 'https://example.org/api.php',
      oauthToken: 'super-secret-value',
    });

    const allLoggedStrings = [
      ...logger.info.mock.calls,
      ...logger.warn.mock.calls,
      ...logger.error.mock.calls,
    ]
      .flat()
      .map((arg) => JSON.stringify(arg));

    for (const logged of allLoggedStrings) {
      expect(logged).not.toContain('super-secret-value');
    }
  });

  test('setOAuthToken updates the token used for subsequent requests', async () => {
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse({ json: { query: { pages: {} } } })
    );

    const client = new Client({
      wikiUrl: 'https://example.org/api.php',
      oauthToken: 'first-token',
    });

    client.setOAuthToken('second-token');
    expect(client.isLoggedIn).toBe(true);

    await client.wikiGet({ action: 'query' });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe(['Bearer', 'second-token'].join(' '));
  });

  test('logout() is a no-op for OAuth clients and does not make a request', async () => {
    const client = new Client({
      wikiUrl: 'https://example.org/api.php',
      oauthToken: 'abc123',
    });

    await client.logout();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('backward compatible string constructor signature still works without OAuth', () => {
    const client = new Client('https://example.org/api.php');
    expect(client.wikiUrl).toBe('https://example.org/api.php');
    expect(client.isLoggedIn).toBe(false);
  });

  test('throws the existing error when no wikiUrl is available from any source', () => {
    expect(() => new Client()).toThrow("you didn't pass the url of your wiki");
  });
});

describe('WikiClient auth method precedence', () => {
  const ENV_KEYS = ['MC_USER', 'MC_PASSWORD', 'MC_OAUTH_TOKEN', 'MC_CONFIG_PATH'];
  let savedEnv;
  let tmpDir;

  beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    for (const key of ENV_KEYS) delete process.env[key];
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamichlol-bot-client-auth-'));
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function authHeaderOfFirstRequest(client) {
    fetchMock.mockResolvedValueOnce(makeFetchResponse({ json: { query: { pages: {} } } }));
    await client.wikiGet({ action: 'query' }).catch(() => {});
    const [, options] = fetchMock.mock.calls[0];
    return options.headers.Authorization;
  }

  test('explicit userName/password options beat MC_OAUTH_TOKEN from the environment', async () => {
    process.env.MC_OAUTH_TOKEN = 'env-token';

    const client = new Client({
      wikiUrl: 'https://example.org/api.php',
      userName: 'optUser',
      password: 'optPassword',
      withLogedIn: false,
    });

    expect(client.isLoggedIn).toBe(false);
    expect(client.userName).toBe('optUser');
    expect(await authHeaderOfFirstRequest(client)).toBeUndefined();
    expect(logger.info).not.toHaveBeenCalled();
  });

  test('an explicit oauthToken option beats MC_USER/MC_PASSWORD and logs that they are ignored', async () => {
    process.env.MC_USER = 'envUser';
    process.env.MC_PASSWORD = 'envPassword';

    const client = new Client({
      wikiUrl: 'https://example.org/api.php',
      oauthToken: 'opt-token',
    });

    expect(client.isLoggedIn).toBe(true);
    expect(client.userName).toBe('');
    expect(await authHeaderOfFirstRequest(client)).toBe(['Bearer', 'opt-token'].join(' '));
    expect(logger.info).toHaveBeenCalled();
  });

  test('MC_USER/MC_PASSWORD from the environment beat an OAuth token in the config file', async () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ auth: { type: 'oauth', oauthToken: 'file-token' } }), {
      mode: 0o600,
    });
    process.env.MC_CONFIG_PATH = configPath;
    process.env.MC_USER = 'envUser';
    process.env.MC_PASSWORD = 'envPassword';

    const client = new Client({ wikiUrl: 'https://example.org/api.php', withLogedIn: false });

    expect(client.isLoggedIn).toBe(false);
    expect(client.userName).toBe('envUser');
    expect(await authHeaderOfFirstRequest(client)).toBeUndefined();
  });

  test('userName from options and MC_PASSWORD from the environment still merge for BotPasswords', async () => {
    process.env.MC_PASSWORD = 'envPassword';

    const client = new Client({ wikiUrl: 'https://example.org/api.php', userName: 'optUser', withLogedIn: false });

    fetchMock
      .mockResolvedValueOnce(makeFetchResponse({ json: { query: { tokens: { logintoken: 'lt' } } } }))
      .mockResolvedValueOnce(makeFetchResponse({ json: { login: { result: 'Success', lgusername: 'optUser' } } }));

    await client.login().catch(() => {});

    const loginCall = fetchMock.mock.calls.find(([, opts]) => String(opts?.body ?? '').includes('action=login'));
    expect(loginCall).toBeDefined();
    const body = String(loginCall[1].body);
    expect(body).toContain('lgname=optUser');
    expect(body).toContain('lgpassword=envPassword');
  });

  test('a single source with both oauthToken and userName/password uses OAuth and logs a message', async () => {
    process.env.MC_USER = 'envUser';

    const client = new Client({
      wikiUrl: 'https://example.org/api.php',
      oauthToken: 'opt-token',
      userName: 'optUser',
      password: 'optPassword',
    });

    expect(client.isLoggedIn).toBe(true);
    expect(client.userName).toBe('');
    expect(await authHeaderOfFirstRequest(client)).toBe(['Bearer', 'opt-token'].join(' '));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('using OAuth'));
  });
});
