import { getRequestsInstance } from "../requests/requests.js";
import wikibase from "../requests/wikibase.js";
import {
  findTemplate,
  getTemplateKeyValueData,
  templateFromKeyValueData,
} from "../parser/newTemplateParser.js";
import logger from "../logger.js";
import WikiBase from "../requests/wikibase.js";

(async () => {
  const client = getRequestsInstance();
  const wikibase = new WikiBase();
  //client.login();

  const pages = await client.query({
    options: {
      prop: "revisions",
      generator: "categorymembers",
      formatversion: "2",
      rvprop: "content",
      rvslots: "main",
      gcmtitle: 'קטגוריה:שגיאות פרמטריות בתבנית נק"ל',
      gcmlimit: "max",
    },
  });

  for (const page in pages) {
    /**
     * @type {string}
     */
    const content = pages[page].revisions[0].slots.main.content;

    const templateText = findTemplate(content, "משרה");
    const templateData = getTemplateKeyValueData(templateText);

    delete templateData["שנות שירות"];

    const newTemplateText = templateFromKeyValueData(templateData, "משרה");

    const { edit, error } = await client.edit({
      pageId: page,
      text: content.replace(templateText, newTemplateText),
      summary: "|=דרגה צבאית >> דרגה",
    });
    if (edit) {
      logger.info(`Edit page: ${pages[page].title}`, edit);
    }
    if (error) {
      logger.error(`Error page: ${pages[page].title}`, error);
    }
  }
  client.logout();
})();

function getQID(content) {
  const regex = /{{מיון ויקיפדיה\|[^}]+פריט=(q\D+)/;
  const match = content.match(regex);
  if (match[1]) {
    return match[1];
  }
  return null;
}
