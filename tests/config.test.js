import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { loadConfig, mergeConfig, mergeAuthConfig } from '../src/config.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hamichlol-bot-config-test-'));
}

describe('config.js', () => {
  let tmpDir;
  const originalEnv = process.env.MC_CONFIG_PATH;

  beforeEach(() => {
    tmpDir = makeTempDir();
    delete process.env.MC_CONFIG_PATH;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalEnv === undefined) {
      delete process.env.MC_CONFIG_PATH;
    } else {
      process.env.MC_CONFIG_PATH = originalEnv;
    }
  });

  describe('loadConfig', () => {
    test('returns an empty object when no config file exists anywhere', () => {
      const config = loadConfig({ cwd: tmpDir });
      expect(config).toEqual({});
    });

    test('loads the default hamichlol-bot.config.json from cwd when it exists', () => {
      const filePath = path.join(tmpDir, 'hamichlol-bot.config.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify({ wikiUrl: 'https://wiki.example/api.php', maxlag: 9 })
      );

      const config = loadConfig({ cwd: tmpDir });
      expect(config.wikiUrl).toBe('https://wiki.example/api.php');
      expect(config.maxlag).toBe(9);
    });

    test('loads a config file from an explicit configPath', () => {
      const filePath = path.join(tmpDir, 'custom-config.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify({ wikiUrl: 'https://wiki.example/api.php' })
      );

      const config = loadConfig({ configPath: filePath, cwd: tmpDir });
      expect(config.wikiUrl).toBe('https://wiki.example/api.php');
    });

    test('loads a config file path from MC_CONFIG_PATH env var', () => {
      const filePath = path.join(tmpDir, 'env-config.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify({ wikiUrl: 'https://wiki.example/api.php' })
      );
      process.env.MC_CONFIG_PATH = filePath;

      const config = loadConfig({ cwd: tmpDir });
      expect(config.wikiUrl).toBe('https://wiki.example/api.php');
    });

    test('throws a descriptive error when an explicit configPath does not exist', () => {
      const missingPath = path.join(tmpDir, 'does-not-exist.json');
      expect(() => loadConfig({ configPath: missingPath, cwd: tmpDir })).toThrow(
        /Config file not found/
      );
    });

    test('throws a descriptive error when the config file cannot be read', () => {
      // A directory exists at this path but cannot be read as a file (EISDIR),
      // simulating a file-read failure distinct from "file not found".
      const dirAsFilePath = path.join(tmpDir, 'not-a-file.json');
      fs.mkdirSync(dirAsFilePath);

      expect(() => loadConfig({ configPath: dirAsFilePath, cwd: tmpDir })).toThrow(
        /Unable to read config file/
      );
    });

    test('does not throw when the default config file is simply absent', () => {
      expect(() => loadConfig({ cwd: tmpDir })).not.toThrow();
    });

    test('throws a descriptive error for invalid JSON', () => {
      const filePath = path.join(tmpDir, 'hamichlol-bot.config.json');
      fs.writeFileSync(filePath, '{ not valid json');

      expect(() => loadConfig({ cwd: tmpDir })).toThrow(/Invalid JSON/);
    });

    test('throws a descriptive error when a field has the wrong type', () => {
      const filePath = path.join(tmpDir, 'hamichlol-bot.config.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify({ wikiUrl: 'https://wiki.example/api.php', maxlag: 'not-a-number' })
      );

      expect(() => loadConfig({ cwd: tmpDir })).toThrow(/"maxlag" must be a number/);
    });

    test('throws a descriptive error for an invalid auth.type', () => {
      const filePath = path.join(tmpDir, 'hamichlol-bot.config.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify({ wikiUrl: 'https://wiki.example/api.php', auth: { type: 'unknown' } })
      );

      expect(() => loadConfig({ cwd: tmpDir })).toThrow(/auth.type/);
    });

    test('throws when auth.type is oauth but auth.oauthToken is missing', () => {
      const filePath = path.join(tmpDir, 'hamichlol-bot.config.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify({ wikiUrl: 'https://wiki.example/api.php', auth: { type: 'oauth' } })
      );

      expect(() => loadConfig({ cwd: tmpDir })).toThrow(/auth.oauthToken.*required/);
    });

    test('throws when auth.type is password but userName/password are missing', () => {
      const filePath = path.join(tmpDir, 'hamichlol-bot.config.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify({ wikiUrl: 'https://wiki.example/api.php', auth: { type: 'password', userName: 'bot' } })
      );

      expect(() => loadConfig({ cwd: tmpDir })).toThrow(/auth.userName.*and.*auth.password.*required/);
    });

    test('throws when both oauthToken and userName/password are set without an explicit auth.type', () => {
      const filePath = path.join(tmpDir, 'hamichlol-bot.config.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify({
          wikiUrl: 'https://wiki.example/api.php',
          auth: { oauthToken: 'tok', userName: 'bot', password: 'secret' },
        })
      );

      expect(() => loadConfig({ cwd: tmpDir })).toThrow(/auth.type.*disambiguate/);
    });

    test('loads password-based auth config', () => {
      const filePath = path.join(tmpDir, 'hamichlol-bot.config.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify({
          wikiUrl: 'https://wiki.example/api.php',
          auth: { type: 'password', userName: 'bot', password: 'secret' },
        })
      );

      const config = loadConfig({ cwd: tmpDir });
      expect(config.auth).toEqual({ type: 'password', userName: 'bot', password: 'secret' });
    });
  });

  describe('mergeConfig', () => {
    test('prefers values from earlier (higher precedence) sources', () => {
      const merged = mergeConfig(
        { wikiUrl: 'from-options' },
        { wikiUrl: 'from-env' },
        { wikiUrl: 'from-file' }
      );
      expect(merged.wikiUrl).toBe('from-options');
    });

    test('falls back to lower precedence sources when a higher one is undefined', () => {
      const merged = mergeConfig(
        { wikiUrl: undefined },
        { wikiUrl: undefined },
        { wikiUrl: 'from-file' }
      );
      expect(merged.wikiUrl).toBe('from-file');
    });

    test('merges distinct keys from all sources', () => {
      const merged = mergeConfig(
        { maxlag: 5 },
        { maxRetries: 3 },
        { wikiUrl: 'from-file' }
      );
      expect(merged).toEqual({ maxlag: 5, maxRetries: 3, wikiUrl: 'from-file' });
    });

    test('ignores null/undefined sources', () => {
      const merged = mergeConfig(undefined, null, { wikiUrl: 'x' });
      expect(merged).toEqual({ wikiUrl: 'x' });
    });
  });

  describe('mergeAuthConfig', () => {
    test('prefers higher precedence credentials', () => {
      const merged = mergeAuthConfig(
        { userName: 'from-options', password: 'pw-options' },
        { userName: 'from-env' },
        { userName: 'from-file', password: 'pw-file' }
      );
      expect(merged).toEqual({ userName: 'from-options', password: 'pw-options' });
    });

    test('suppresses userName/password from a source declared as type "oauth"', () => {
      const merged = mergeAuthConfig(
        {},
        {},
        { type: 'oauth', oauthToken: 'tok', userName: 'ignored', password: 'ignored' }
      );
      expect(merged).toEqual({ oauthToken: 'tok' });
    });

    test('suppresses oauthToken from a source declared as type "password"', () => {
      const merged = mergeAuthConfig(
        {},
        {},
        { type: 'password', userName: 'bot', password: 'secret', oauthToken: 'ignored' }
      );
      expect(merged).toEqual({ userName: 'bot', password: 'secret' });
    });

    test('ignores undefined/null sources', () => {
      const merged = mergeAuthConfig(undefined, null, { oauthToken: 'tok' });
      expect(merged).toEqual({ oauthToken: 'tok' });
    });
  });
});
