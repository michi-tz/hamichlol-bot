// חלק מהקוד בתיקיה זו נלקח או הותאם ממאגר הקוד הפתוח: https://github.com/EladHeller/wiki-bot
// ראה קובץ CREDITS.md לפרטים נוספים
import { nextWikiText } from './WikiParser.js';

function getInnerLinks(text) {
  const links = [];
  let currIndex = 0;
  let nextLinkIndex = nextWikiText(text, currIndex, '[[', true);
  while (nextLinkIndex !== -1 && currIndex < text.length) {
    const endLinkIndex = nextWikiText(text, nextLinkIndex + 2, ']]', true);
    if (endLinkIndex === -1) {
      return links;
    }
    const link = text.substring(nextLinkIndex + 2, endLinkIndex);
    const linkParts = link.split('|');
    const innerLink = linkParts[0].startsWith(':') ? linkParts[0].substring(1) : linkParts[0];
    const currentLink = { link: innerLink, text: linkParts[1] ?? innerLink };
    if (linkParts.length > 2) {
      currentLink.params = linkParts.slice(1);
    }
    links.push(currentLink);
    currIndex = endLinkIndex + 2;
    nextLinkIndex = nextWikiText(text, currIndex, '[[', true);
  }
  return links;
}

function getInnerLink(text) {
  const [link] = getInnerLinks(text);
  return link;
}

function getExternalLinks(text) {
  const links = [];
  let currIndex = 0;
  let nextLinkIndex = nextWikiText(text, currIndex, '[', true);
  while (nextLinkIndex !== -1 && currIndex < text.length) {
    if (text[nextLinkIndex + 1] === '[') {
      currIndex = nextLinkIndex + 2;
    } else {
      const endLinkIndex = nextWikiText(text, nextLinkIndex + 1, ']', true);
      if (endLinkIndex === -1) {
        return links;
      }
      const linkText = text.substring(nextLinkIndex + 1, endLinkIndex).trim();
      const [link, ...description] = linkText.split(' ');
      links.push({ link, text: description.join(' ') });
      currIndex = endLinkIndex + 1;
    }
    nextLinkIndex = nextWikiText(text, currIndex, '[', true);
  }
  return links;
}

function getExternalLink(text) {
  const [link] = getExternalLinks(text);
  return link;
}

export {
  getInnerLinks,
  getInnerLink,
  getExternalLinks,
  getExternalLink,
};
