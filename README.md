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
- `scheduled/` - Scheduled Scripts

### `tests/` - Unit Tests

## Installation and Running

```bash
# Install packages
pnpm install

# Run tests
pnpm test

# Code linting
pnpm run lint:test
```

## Main Features

- Content import from Wikipedia
- Template processing and updating
- Category and image management
- Advanced logging system
- **Scheduled task system** 🆕

## Authentication & Configuration 🆕

`WikiClient` (`src/requests/Client.js`) supports two authentication methods:

- **BotPasswords** (default) — set `MC_USER` / `MC_PASSWORD` env vars, or call `client.login(userName, password)`.
- **OAuth 2.0 (owner-only consumer / personal access token)** — create one at
  [Special:OAuthConsumerRegistration](https://www.mediawiki.org/wiki/OAuth/Owner-only_consumers) on your wiki,
  then provide the access token via the `MC_OAUTH_TOKEN` env var or the `oauthToken` constructor option.
  When an OAuth token is configured, the client sends an `Authorization` header with a bearer token on every
  request and
  skips the BotPasswords login flow entirely. Use `client.setOAuthToken(token)` to rotate the token at runtime.
  If both OAuth and BotPasswords credentials are supplied, OAuth takes precedence.

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

## License

This project was written by moti of hamichlol.org.il
