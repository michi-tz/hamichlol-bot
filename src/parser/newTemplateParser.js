// GENERATED FILE - DO NOT EDIT.
// Run `npm run sync:parser` to regenerate it; local changes will be overwritten.
// Generated from https://github.com/EladHeller/wiki-bot@c22bbf1ebbf19aabf30fe110491d926499b8d760
// Original path: bot/wiki/newTemplateParser.ts
// Source: wiki-bot (github.com/EladHeller), ISC license. See src/parser/CREDITS.md.

import './regexpEscapePolyfill.js'; // local polyfill, see src/parser/CREDITS.md

import { parseWikiStructures, nextWikiText } from './WikiParser.js';

const isStructureInsideAnother = (
  inner,
  outer,
) => inner.start > outer.start && inner.end <= outer.end;

export function findTemplates(text, templateName, title) {
  const structures = parseWikiStructures(text, 0, title);
  const templateStartRegex = new RegExp(`^{{\\s*${RegExp.escape(templateName)}`);
  const templateRegex = new RegExp(`^{{\\s*${RegExp.escape(templateName)}\\s*[|}]`);

  const templateStructures = structures.filter((s) => s.type === 'template' || s.type === 'parameter');
  const skipRanges = [];
  const matchingTemplates = [];

  templateStructures.forEach((structure) => {
    const insideSkippedRange = skipRanges.some((range) => isStructureInsideAnother(structure, range));

    if (insideSkippedRange) {
      return;
    }

    const templateText = text.substring(structure.start, structure.end);
    const startsWithName = templateText.match(templateStartRegex);

    if (startsWithName != null) {
      const matchesRegex = templateText.match(templateRegex);

      if (matchesRegex) {
        matchingTemplates.push(templateText);
      } else {
        skipRanges.push(structure);
      }
    }
  });

  return matchingTemplates;
}

export function findTemplate(text, templateName, title) {
  const templates = findTemplates(text, templateName, title);
  return templates.length ? templates[0] : '';
}

export function getTemplateKeyValueData(templateText) {
  const obj = {};
  if (templateText) {
    let currIndex = templateText.indexOf('|') + 1;
    if (currIndex === 0) {
      return {};
    }

    let isTemplateEnd = false;
    while (!isTemplateEnd) {
      let value;
      const equalSignIndex = templateText.indexOf('=', currIndex);
      if (equalSignIndex === -1) {
        return obj;
      }
      const key = templateText.substring(currIndex, equalSignIndex).trim();
      const pipeSignIndex = nextWikiText(templateText, currIndex, '|');
      isTemplateEnd = pipeSignIndex === -1;

      if (isTemplateEnd) {
        value = templateText.substring(equalSignIndex + 1, templateText.length - 2).trim();
      } else {
        value = templateText.substring(equalSignIndex + 1, pipeSignIndex).trim();
      }

      obj[key] = value;
      currIndex = pipeSignIndex + 1;
    }
  }
  return obj;
}

export function templateFromKeyValueData(
  data,
  templateName,
  newLines = true,
) {
  const endOfValue = newLines ? '\n' : '';
  let templateStr = `{{${templateName}`;

  Object.entries(data).forEach(([key, value], index) => {
    if (index > 0) {
      templateStr += `|${key}=${value}${endOfValue}`;
    } else {
      templateStr += `${endOfValue}|${key}=${value}${endOfValue}`;
    }
  });
  templateStr += '}}';

  return templateStr;
}

export function getTemplateArrayData(
  templateText,
  templateName,
  title,
  ignoreNamedParams = false,
) {
  const templateContent = templateText.replace(`{{${templateName}`, '').replace(/}}$/, '');
  if (!templateContent.match(/^\s*\|/)) {
    return [];
  }
  let currIndex = nextWikiText(templateContent, 0, '|', false, title);
  let dataIndex = 0;
  const data = [];
  while (currIndex !== -1 && templateContent.length > 0) {
    currIndex += 1;
    const nextIndex = nextWikiText(templateContent, currIndex, '|', false, title);
    let value;
    if (nextIndex === -1) {
      value = templateContent.substring(currIndex).trim();
    } else {
      value = templateContent.substring(currIndex, nextIndex).trim();
    }
    const equalSignIndex = nextWikiText(value, 0, '=', false, title);
    if (!ignoreNamedParams || equalSignIndex === -1) {
      data[dataIndex] = value;
      dataIndex += 1;
    } else {
      const key = value.substring(0, equalSignIndex).trim();
      if (key.match('^[0-9]+$')) {
        data[Number(key) - 1] = value.substring(equalSignIndex + 1).trim();
      }
    }
    currIndex = nextIndex;
  }

  return data;
}

export function templateFromArrayData(data, templateName) {
  return `{{${templateName}|${data.join('|')}}}`;
}

export function getTemplateData(
  templateText,
  templateName,
  title,
) {
  const templateStartRegex = new RegExp(`^{{\\s*${RegExp.escape(templateName)}`);
  const templateContent = templateText.replace(templateStartRegex, '').replace(/}}$/, '');
  if (!templateContent.match(/^\s*\|/)) {
    return {};
  }
  let currIndex = nextWikiText(templateContent, 0, '|', false, title);
  let dataIndex = 0;
  const keyValueData = {};
  const arrayData = [];
  while (currIndex !== -1 && templateContent.length > 0) {
    currIndex += 1;
    const nextIndex = nextWikiText(templateContent, currIndex, '|', false, title);
    let value;
    if (nextIndex === -1) {
      value = templateContent.substring(currIndex).trim();
    } else {
      value = templateContent.substring(currIndex, nextIndex).trim();
    }
    const equalSignIndex = nextWikiText(value, 0, '=', false, title);
    if (equalSignIndex === -1) {
      arrayData[dataIndex] = value;
      dataIndex += 1;
    } else {
      const key = value.substring(0, equalSignIndex).trim();
      if (key.match(/^[0-9]+$/)) {
        arrayData[Number(key) - 1] = value.substring(equalSignIndex + 1).trim();
      } else {
        keyValueData[key] = value.substring(equalSignIndex + 1).trim();
      }
    }
    currIndex = nextIndex;
  }

  return {
    arrayData,
    keyValueData,
  };
}

export function templateFromTemplateData(templateData, templateName) {
  let templateStr = `{{${templateName}`;
  if (templateData.arrayData) {
    templateStr += `|${templateData.arrayData.join('|')}`;
  }
  if (templateData.keyValueData) {
    Object.entries(templateData.keyValueData).forEach(([key, value]) => {
      templateStr += `|${key}=${value}`;
    });
  }
  return `${templateStr}}}`;
}
