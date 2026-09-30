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
- **Scheduled task system** 🆕

## License

This project was written by moti of hamichlol.org.il
