# Hamichlol Bot

A bot for managing and updating content on the Hamichlol website.

**[עברית](README.he.md)** | English

## Project Structure

### `src/` - Main Source Code
- `logger.js` - Logging system
- `import/` - Content import tools
- `parser/` - Wiki content parsers
- `requests/` - HTTP clients and server requests
- `scripts/` - General scripts and utilities

### `tests/` - Unit Tests

## Installation and Running

```bash
# Install packages
npm install

# Run tests
npm test

# Code linting
npm run lint:test
```

## Running the Tests (Jest)

Tests are written with [Jest](https://jestjs.io/) (using `babel-jest` to transpile `import`/`export` syntax) and live under the `tests/` directory, mirroring the structure of `src/` (e.g. `tests/requests/utils/cookie.test.js` tests `src/requests/utils/cookie.js`).

```bash
# Run the full test suite with a code coverage report
npm test

# Run a single test file
npm test -- tests/requests/requests.test.js

# Run without the coverage report (faster)
npm test -- --no-coverage
```

Tests are isolated from the network and disk: HTTP calls (`node-fetch`) and the logger (`src/logger.js`) are mocked, so running the test suite does not require an internet connection and does not write real log files.


## Main Features

- Content import from Wikipedia
- Template processing and updating
- Category and image management
- Advanced logging system

## Authentication & Configuration 🆕

`WikiClient` (`src/requests/Client.js`) supports two authentication methods:

- **BotPasswords** (default) — set `MC_USER` / `MC_PASSWORD` env vars, or call `client.login(userName, password)`.
- **OAuth 2.0 (owner-only consumer / personal access token)** — create one at
  [Special:OAuthConsumerRegistration](https://www.mediawiki.org/wiki/OAuth/Owner-only_consumers) on your wiki,
  then provide the access token via the `MC_OAUTH_TOKEN` env var or the `oauthToken` constructor option.
  When an OAuth token is configured, the client sends an `Authorization` header with a bearer token on every
  request and
  skips the BotPasswords login flow entirely. Use `client.setOAuthToken(token)` to rotate the token at runtime.
  The auth method is chosen by the highest-precedence source (see below) that supplies any credentials, so e.g.
  `userName`/`password` passed to the constructor win over `MC_OAUTH_TOKEN` in the environment. If that one source
  supplies both an OAuth token and BotPasswords credentials, OAuth takes precedence.

### Config file

Instead of (or in addition to) environment variables, you can put client settings and credentials in a JSON
config file. By default, `WikiClient` looks for `./hamichlol-bot.config.json` in the current working directory
(only if it exists); you can point to a different file with the `configPath` constructor option or the
`MC_CONFIG_PATH` env var. See `hamichlol-bot.config.example.json` for the format.

Settings are resolved with this precedence (highest to lowest):
**constructor options > environment variables > config file > built-in defaults.**

```json
{
  "wikiUrl": "https://www.hamichlol.org.il/w/api.php",
  "maxlag": 5,
  "maxRetries": 3,
  "withLogedIn": true,
  "userAgent": "hamichlol-bot",
  "auth": {
    "type": "oauth",
    "oauthToken": "..."
  }
}
```

`auth.type` can be `"oauth"` (with `oauthToken`) or `"password"` (with `userName` and `password`).
Since it may contain secrets, `hamichlol-bot.config.json` is git-ignored — copy the example file and fill in
your own values.

## Wiki Parser (`src/parser/`) and Upstream Sync

The wikitext parsers in `src/parser/` come from the open-source
[wiki-bot](https://github.com/EladHeller/wiki-bot) project (ISC license). They are not edited by
hand: they are generated from the upstream TypeScript sources (types erased, nothing else changed) at
the commit pinned in `src/parser/upstream.json`. Generated files start with `// GENERATED FILE`;
the few local files start with `// LOCAL FILE`. Details are in `src/parser/CREDITS.md`.

```bash
# Regenerate src/parser from the pinned commit (should produce no changes)
npm run sync:parser

# Move the pin to upstream's latest commit and regenerate
npm run sync:parser -- --latest

# Or to a specific full commit SHA / branch / tag
npm run sync:parser -- --ref <sha>
```

A weekly GitHub Actions workflow (`.github/workflows/sync-parser.yml`) runs the `--latest` sync and opens
a pull request when upstream changed.

## License

This project was written by moti of hamichlol.org.il
