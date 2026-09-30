// Global Jest setup, referenced by `setupFilesAfterEach` in jest.config.mjs.
// Kept intentionally minimal: only provides safe defaults for environment
// variables consumed by the source modules (e.g. Client.js reads
// process.env.MC_USER / MC_PASSWORD via dotenv) so tests never depend on a
// developer's local .env file or real credentials.
process.env.MC_USER = process.env.MC_USER || "test-user";
process.env.MC_PASSWORD = process.env.MC_PASSWORD || "test-password";
process.env.LOG_DIR = process.env.LOG_DIR || "./logs";
