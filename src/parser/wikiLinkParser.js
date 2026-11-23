// GENERATED FILE - DO NOT EDIT.
// Run `npm run sync:parser` to regenerate it; local changes will be overwritten.
// Generated from https://github.com/EladHeller/wiki-bot@c22bbf1ebbf19aabf30fe110491d926499b8d760
// Original path: bot/wiki/wikiLinkParser.ts
// Source: wiki-bot (github.com/EladHeller), ISC license. See src/parser/CREDITS.md.

import { parseWikiStructures } from './WikiParser.js';

export function getInnerLinks(text) {
  const structures = parseWikiStructures(text);
  const wikilinks = structures.filter((s) => s.type === 'wikilink');

  return wikilinks.map((structure) => {
    const linkContent = text.substring(structure.start + 2, structure.end - 2);
    const linkParts = linkContent.split('|');
    const innerLink = linkParts[0].startsWith(':') ? linkParts[0].substring(1) : linkParts[0];
    const currentLink = { link: innerLink, text: linkParts[1] ?? innerLink };
    if (linkParts.length > 2) {
      currentLink.params = linkParts.slice(1);
    }
    return currentLink;
  });
}

export function getInnerLink(text) {
  const [link] = getInnerLinks(text);
  return link;
}

export function getExternalLinks(text) {
  const structures = parseWikiStructures(text);
  const externalLinks = structures.filter((s) => s.type === 'link');

  return externalLinks.map((structure) => {
    const linkText = text.substring(structure.start + 1, structure.end - 1).trim();
    const [link, ...description] = linkText.split(' ');
    return { link, text: description.join(' ') };
  }).filter((wikiLink) => wikiLink.link.match(/^[a-zA-Z]+:\/\/\w+/));
}

export function getExternalLink(text) {
  const [link] = getExternalLinks(text);
  return link;
}
