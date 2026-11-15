// GENERATED FILE - DO NOT EDIT.
// Run `npm run sync:parser` to regenerate it; local changes will be overwritten.
// Generated from https://github.com/EladHeller/wiki-bot@1f97761c8dcacb1457c51de976f91a1b14d50afb
// Original path: bot/wiki/redirectParser.ts
// Source: wiki-bot (github.com/EladHeller), ISC license. See src/parser/CREDITS.md.

import { getInnerLink } from './wikiLinkParser.js';

const REDIRECT_ONLY_REGEX = /^\s*#\S+\s*\[\[[^\]]+\]\]$/i;
const REDIRECT_START_REGEX = /^\s*#\S+\s*\[\[[^\]]+\]\]/i;

export function getRedirectTargetFromContent(content, redirectOnly = true) {
  const normalized = content.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const firstNonEmptyLine = normalized
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstNonEmptyLine) {
    return null;
  }
  const regex = redirectOnly ? REDIRECT_ONLY_REGEX : REDIRECT_START_REGEX;
  if (!normalized.match(regex)) {
    return null;
  }

  const redirectLink = getInnerLink(normalized);

  if (!redirectLink?.link) {
    return null;
  }

  return redirectLink.link.trim();
}

export function isRedirectContent(content) {
  return getRedirectTargetFromContent(content) != null;
}
