import fs from "fs";
import path from "path";

const DEFAULT_CONFIG_FILENAME = "hamichlol-bot.config.json";

/**
 * Loads client configuration from a JSON config file.
 *
 * Resolution order for the file to read:
 * 1. `configPath` argument, if provided (errors if the file does not exist or is invalid).
 * 2. `MC_CONFIG_PATH` environment variable, if set (same error behavior as above).
 * 3. `hamichlol-bot.config.json` in `cwd`, but only if it exists (no error if it is absent).
 *
 * @param {Object} [options]
 * @param {string} [options.configPath] - Explicit path to a config file.
 * @param {string} [options.cwd] - Working directory used to resolve the default config file. Defaults to `process.cwd()`.
 * @returns {Object} The parsed configuration object, or `{}` if no config file was found/needed.
 * @throws {Error} If an explicitly requested config file (via `configPath` or `MC_CONFIG_PATH`) is missing or invalid.
 */
export function loadConfig({ configPath, cwd = process.cwd() } = {}) {
  const explicitPath = configPath || process.env.MC_CONFIG_PATH;

  if (explicitPath) {
    return readConfigFile(explicitPath, { required: true });
  }

  const defaultPath = path.resolve(cwd, DEFAULT_CONFIG_FILENAME);
  if (fs.existsSync(defaultPath)) {
    return readConfigFile(defaultPath, { required: false });
  }

  return {};
}

/**
 * Reads and parses a JSON config file.
 *
 * @param {string} filePath
 * @param {Object} [opts]
 * @param {boolean} [opts.required=true] - Whether to throw a descriptive error when the file is missing.
 * @returns {Object}
 */
function readConfigFile(filePath, { required = true } = {}) {
  if (!fs.existsSync(filePath)) {
    if (required) {
      throw new Error(`Config file not found: ${filePath}`);
    }
    return {};
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read config file "${filePath}": ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in config file "${filePath}": ${error.message}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Invalid config file "${filePath}": expected a JSON object`);
  }

  validateConfigShape(parsed, filePath);

  return parsed;
}

/**
 * Performs light type validation on a parsed config object, throwing descriptive errors
 * for common mistakes.
 *
 * @param {Object} config
 * @param {string} filePath
 */
function validateConfigShape(config, filePath) {
  const stringFields = ["wikiUrl", "userAgent"];
  for (const field of stringFields) {
    if (config[field] !== undefined && typeof config[field] !== "string") {
      throw new Error(`Invalid config file "${filePath}": "${field}" must be a string`);
    }
  }

  const numberFields = ["maxlag", "maxRetries"];
  for (const field of numberFields) {
    if (config[field] !== undefined && typeof config[field] !== "number") {
      throw new Error(`Invalid config file "${filePath}": "${field}" must be a number`);
    }
  }

  if (config.withLogedIn !== undefined && typeof config.withLogedIn !== "boolean") {
    throw new Error(`Invalid config file "${filePath}": "withLogedIn" must be a boolean`);
  }

  if (config.auth !== undefined) {
    if (typeof config.auth !== "object" || config.auth === null || Array.isArray(config.auth)) {
      throw new Error(`Invalid config file "${filePath}": "auth" must be an object`);
    }
    const { type, oauthToken, userName, password } = config.auth;
    if (type !== undefined && type !== "oauth" && type !== "password") {
      throw new Error(`Invalid config file "${filePath}": "auth.type" must be "oauth" or "password"`);
    }
    if (oauthToken !== undefined && typeof oauthToken !== "string") {
      throw new Error(`Invalid config file "${filePath}": "auth.oauthToken" must be a string`);
    }
    if (userName !== undefined && typeof userName !== "string") {
      throw new Error(`Invalid config file "${filePath}": "auth.userName" must be a string`);
    }
    if (password !== undefined && typeof password !== "string") {
      throw new Error(`Invalid config file "${filePath}": "auth.password" must be a string`);
    }
  }
}

/**
 * Merges settings from multiple sources following this precedence (highest to lowest):
 * explicit options > environment variables > config file > defaults.
 *
 * Each source object may contain `undefined` values, which are treated as "not set" and
 * are skipped in favor of a lower-precedence source.
 *
 * @param {...Object} sources - Objects to merge, ordered from highest to lowest precedence.
 * @returns {Object} The merged settings object.
 */
export function mergeConfig(...sources) {
  const result = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined && result[key] === undefined) {
        result[key] = value;
      }
    }
  }
  return result;
}

export default { loadConfig, mergeConfig };
