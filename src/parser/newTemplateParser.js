import { escapeRegex } from './utilities.js';
import { nextWikiText } from './WikiParser.js';

export function findTemplates(text, templateName, title) {
  const templates = [];
  let currIndex = 0;
  let templateStartIndex = 0;
  let templateEndIndex = 0;
  const templateStart = `{{${templateName}`;
  while (currIndex < text.length) {
    templateStartIndex = text.substring(currIndex).indexOf(templateStart);
    if (templateStartIndex === -1) {
      break;
    }
    templateStartIndex = currIndex + templateStartIndex;
    templateEndIndex = nextWikiText(text, templateStartIndex + templateStart.length, '}}');
    if (templateEndIndex === -1) {
      console.log('Error: template end not found', title, text.substring(templateStartIndex, templateStartIndex + 100));
      break;
    }
    const templateText = text.substring(templateStartIndex, templateEndIndex + 2);
    if (templateText.match(new RegExp(`^{{${escapeRegex(templateName)}\\s*[|}]`))) {
      templates.push(text.substring(templateStartIndex, templateEndIndex + 2));
    }
    currIndex = templateEndIndex + 2;
  }
  return templates;
}

export function findTemplate(text, templateName, title) {
  const templates = findTemplates(text, templateName, title);
  return templates.length ? templates[0] : '';
}

export function getTemplateKeyValueData(templateText) {
  const obj = {};
  if (templateText) {
    let currIndex = templateText.indexOf('|') + 1;
    let isTemplateEnd = false;
    while (!isTemplateEnd) {
      let value;
      const equalSignIndex = templateText.indexOf('=', currIndex);
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

export function templateFromKeyValueData(data, templateName, newLines = true) {
  const endOfValue = newLines ? '\n' : '';
  let templateStr = `{{${templateName}${endOfValue}`;
  Object.entries(data).forEach(([key, value]) => {
    templateStr += `|${key}=${value}${endOfValue}`;
  });
  templateStr += '}}';
  return templateStr;
}

export function getTemplateArrayData(templateText, templateName, title, ignoreNamedParams = false) {
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

export function getTemplateData(templateText, templateName, title) {
  const templateContent = templateText.replace(`{{${templateName}`, '').replace(/}}$/, '');
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
