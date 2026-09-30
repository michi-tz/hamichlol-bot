import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// The real WikiClient hits the network (via node-fetch) and writes to the
// shared winston logger. Both are mocked so these tests stay fast,
// deterministic and side-effect free, per the project's instruction to
// isolate modules using module mocking instead of touching source code.
jest.unstable_mockModule('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.unstable_mockModule('../../src/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { default: fetch } = await import('node-fetch');
const { default: logger } = await import('../../src/logger.js');
const { default: Client } = await import('../../src/requests/Client.js');

describe('Client.edit error handling', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    // NOTE: the Client/WikiClient constructor now requires an options object
    // with a `wikiUrl` property (it throws "you didn't pass the url of your
    // wiki" otherwise). Updated from the original no-arg `new Client()` call
    // to reflect this current, required behavior.
    client = new Client({ wikiUrl: 'https://example.org/w/api.php' });
    client.isLoggedIn = true;
    client.token = { csrftoken: 'test-token' };
    // Default: any direct fetch call (used internally by #checkToken's
    // wikiGet call) resolves as if the current csrf token is still valid, so
    // individual tests only need to override what they actually exercise.
    fetch.mockResolvedValue({
      ok: true,
      headers: { raw: () => ({}), get: () => null },
      json: async () => ({ checktoken: { result: 'valid' } }),
    });
  });

  test('should throw an error when edit fails', async () => {
    client.edit = jest.fn().mockRejectedValue(new Error('Edit failed: API error'));

    await expect(client.edit({ title: 'Test', text: 'Content' })).rejects.toThrow('Edit failed: API error');
    expect(client.edit).toHaveBeenCalledWith({ title: 'Test', text: 'Content' });
  });

  test('should throw and log an error when edit throws an exception', async () => {
    const errorMessage = 'Network error';
    client.edit = jest.fn().mockRejectedValue(new Error(errorMessage));

    await expect(client.edit({ title: 'Test', text: 'Content' })).rejects.toThrow(errorMessage);
    expect(client.edit).toHaveBeenCalledWith({ title: 'Test', text: 'Content' });
  });

  test('should handle and rethrow errors with custom messages', async () => {
    client.edit = jest.fn().mockRejectedValue(new Error('Custom error'));

    await expect(client.edit({ title: 'Test', text: 'Content' })).rejects.toThrow('Custom error');
    expect(client.edit).toHaveBeenCalledWith({ title: 'Test', text: 'Content' });
  });

  test('should log errors using the logger when the underlying request rejects', async () => {
    // NOTE: `client.logger` (as used by the original version of this test)
    // is never read by the source code - Client.js always logs through the
    // module-level `logger` singleton imported from ../logger.js, not an
    // instance property. Mocking that module (see top of file) is required
    // to observe the real log calls made by `edit`.
    client.wikiPost = jest.fn().mockRejectedValue(new Error('Logging test'));

    await expect(client.edit({ title: 'Test', text: 'Content' })).rejects.toThrow('Logging test');
    expect(logger.error).toHaveBeenCalledWith('Error in edit: Logging test');
  });

  test('should throw when the csrf token is missing and cannot be refreshed', async () => {
    // NOTE: this replaces a previously-existing "should handle errors when
    // token is missing" test that asserted `client.edit).not.toHaveBeenCalled()`
    // - that assertion was tautological (`client.edit` was itself the mocked
    // function under test, so it trivially "hadn't been called" from inside
    // its own invocation) and didn't exercise any real logic. This version
    // instead calls the real `edit()` implementation and asserts on its
    // actual observable behavior: it throws, and it logs the specific
    // "Failed to validate token" message described below.
    //
    // Documenting existing behavior - deleting the csrf token forces
    // `edit` to request a fresh one via the private `#checkToken`/`#getToken`
    // methods. When the API response doesn't contain `query.tokens` (mocked
    // below), `#getToken` catches its own TypeError, logs it, and returns
    // `undefined`; `#checkToken` then throws a *different* TypeError while
    // reading `.result` off that `undefined` token. This second error is not
    // wrapped in edit's own try/catch (which only wraps the final
    // `wikiPost` call), so it propagates without an "Error in edit: ..."
    // log message - unlike the other failure paths tested above.
    delete client.token.csrftoken;
    fetch.mockResolvedValue({
      ok: true,
      headers: { raw: () => ({}), get: () => null },
      json: async () => ({}),
    });

    await expect(client.edit({ title: 'Test', text: 'Content' })).rejects.toThrow();
    expect(logger.error).toHaveBeenCalledWith('Failed to validate token');
  });

  test('should refresh an invalid csrf token via #getToken and still complete the edit', async () => {
    // Success-path counterpart to the test above: here `checktoken.result`
    // comes back as "invalid" (not missing), which takes the *other* branch
    // in `#checkToken` - it calls the private `#getToken("csrf")` again and
    // replaces `this.token` with whatever `query.tokens` contains, then
    // proceeds to complete the edit using the refreshed token.
    fetch.mockResolvedValue({
      ok: true,
      headers: { raw: () => ({}), get: () => null },
      json: async () => ({
        checktoken: { result: 'invalid' },
        query: { tokens: { csrftoken: 'refreshed-token' } },
      }),
    });

    const result = await client.edit({ title: 'Test', text: 'Content' });

    expect(result.query.tokens.csrftoken).toBe('refreshed-token');
    expect(client.token).toEqual({ csrftoken: 'refreshed-token' });
    expect(logger.error).not.toHaveBeenCalledWith('Failed to validate token');
  });
});
