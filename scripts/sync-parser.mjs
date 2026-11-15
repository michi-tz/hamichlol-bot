#!/usr/bin/env node
// Regenerates src/parser/*.js from the upstream wiki-bot TypeScript sources.
//
//   npm run sync:parser                 regenerate from the commit pinned in src/parser/upstream.json
//   npm run sync:parser -- --latest     move the pin to upstream's default-branch head, then regenerate
//   npm run sync:parser -- --ref <ref>  move the pin to a full commit SHA, branch or tag, then regenerate
//
// Upstream is fetched with git (shallow fetch of a single commit into a
// temporary directory). Files are only read from git objects: nothing from
// upstream is checked out, installed or executed.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GENERATED_MARKER, LOCAL_MARKER, SyncError, convertFile, parseArgs, validateConfig,
} from './sync-parser-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'src/parser/upstream.json');

function git(args, options = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      ...options,
    });
  } catch (error) {
    const stderr = error.stderr?.toString().trim();
    throw new SyncError(`git ${args.join(' ')} failed${stderr ? `:\n${stderr}` : ` (${error.message})`}`);
  }
}

function fetchUpstream(repo, ref, tmpDir) {
  git(['init', '--quiet', '--bare', tmpDir]);
  git(['-C', tmpDir, 'fetch', '--quiet', '--depth=1', '--no-tags', repo, ref]);
  const sha = git(['-C', tmpDir, 'rev-parse', '--verify', 'FETCH_HEAD^{commit}']).trim();
  if (/^[0-9a-f]{40}$/.test(ref) && sha !== ref) {
    throw new SyncError(`Fetched ${sha} but asked for ${ref}`);
  }
  return sha;
}

function readUpstreamFile(tmpDir, sha, upstreamPath) {
  try {
    return git(['-C', tmpDir, 'show', `${sha}:${upstreamPath}`]);
  } catch {
    throw new SyncError(`${upstreamPath} does not exist in upstream at ${sha}. Update "files" in src/parser/upstream.json.`);
  }
}

/** Every .js file in the output directories must be either generated or a declared local file. */
function planCleanup(config, outputs) {
  const dirs = new Set(Object.values(config.files).map((p) => path.posix.dirname(p)));
  const generated = new Set(Object.keys(outputs));
  const local = new Set(config.localFiles);
  const stale = [];
  const problems = [];
  local.forEach((p) => {
    const abs = path.join(ROOT, p);
    if (!fs.existsSync(abs)) {
      problems.push(`${p} is listed in "localFiles" but does not exist`);
    } else if (!fs.readFileSync(abs, 'utf8').startsWith(LOCAL_MARKER)) {
      problems.push(`${p} is a local file and must start with "${LOCAL_MARKER}"`);
    }
  });
  dirs.forEach((dir) => {
    fs.readdirSync(path.join(ROOT, dir))
      .filter((name) => name.endsWith('.js'))
      .map((name) => path.posix.join(dir, name))
      .filter((p) => !generated.has(p) && !local.has(p))
      .forEach((p) => {
        if (fs.readFileSync(path.join(ROOT, p), 'utf8').startsWith(GENERATED_MARKER)) {
          stale.push(p); // generated earlier, no longer mapped
        } else {
          problems.push(`${p} is neither generated nor listed in "localFiles" of src/parser/upstream.json`);
        }
      });
  });
  if (problems.length) throw new SyncError(problems.join('\n'));
  return stale;
}

/** Writes all files only after everything was generated; temp files + rename keep each file whole. */
function writeOutputs(outputs, stale, configText) {
  const pending = [...Object.entries(outputs), [path.relative(ROOT, CONFIG_PATH), configText]]
    .filter(([p, content]) => {
      const abs = path.join(ROOT, p);
      return !fs.existsSync(abs) || fs.readFileSync(abs, 'utf8') !== content;
    });
  const temps = [];
  try {
    pending.forEach(([p, content]) => {
      const tmp = `${path.join(ROOT, p)}.sync-tmp`;
      temps.push(tmp);
      fs.writeFileSync(tmp, content);
    });
  } catch (error) {
    temps.forEach((tmp) => fs.rmSync(tmp, { force: true }));
    throw new SyncError(`Could not write output: ${error.message}`);
  }
  pending.forEach(([p]) => fs.renameSync(`${path.join(ROOT, p)}.sync-tmp`, path.join(ROOT, p)));
  stale.forEach((p) => fs.rmSync(path.join(ROOT, p)));
  return { changed: pending.map(([p]) => p), removed: stale };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let config;
  try {
    config = validateConfig(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
  } catch (error) {
    throw error instanceof SyncError ? error : new SyncError(`Cannot read ${CONFIG_PATH}: ${error.message}`);
  }
  const ref = args.latest ? 'HEAD' : (args.ref ?? config.commit);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-parser-'));
  let sha;
  const outputs = {};
  try {
    console.log(`Fetching ${config.repo} (${ref === 'HEAD' ? 'default branch head' : ref})...`);
    sha = fetchUpstream(config.repo, ref, tmpDir);
    Object.entries(config.files).forEach(([upstreamPath, localPath]) => {
      const source = readUpstreamFile(tmpDir, sha, upstreamPath);
      try {
        outputs[localPath] = convertFile(source, {
          repo: config.repo,
          commit: sha,
          license: config.license,
          upstreamPath,
          localPath,
          mapping: config.files,
          polyfills: config.polyfills,
        });
      } catch (error) {
        throw new SyncError(`Converting ${upstreamPath}: ${error.message}`);
      }
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const stale = planCleanup(config, outputs);
  // Keep the file as written by hand, only move the pin.
  const newConfig = { ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')), commit: sha };
  const { changed, removed } = writeOutputs(outputs, stale, `${JSON.stringify(newConfig, null, 2)}\n`);

  console.log(`Pinned upstream commit: ${sha}${sha !== config.commit ? ` (was ${config.commit})` : ''}`);
  if (!changed.length && !removed.length) {
    console.log('src/parser is up to date.');
  } else {
    changed.forEach((p) => console.log(`  updated ${p}`));
    removed.forEach((p) => console.log(`  removed ${p}`));
  }
}

try {
  main();
} catch (error) {
  console.error(`sync:parser failed: ${error instanceof SyncError ? error.message : error.stack}`);
  console.error('Nothing was written.');
  process.exitCode = 1;
}
