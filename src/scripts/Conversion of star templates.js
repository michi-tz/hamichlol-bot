import { Requests } from "../requests/requests.js";
import {
  findTemplate,
  getTemplateKeyValueData,
  templateFromKeyValueData,
} from "../parser/newTemplateParser.js";
import logger from "../logger.js";

const req = new Requests("https://www.hamichlol.org.il/w/api.php");
const templateName = "אסטרואיד";

async function main() {
  try {
    const queryResult = await req.query({
      options: {
        prop: "revisions",
        generator: "embeddedin",
        formatversion: "2",
        rvprop: "content",
        rvslots: "main",
        geititle: "תבנית:" + templateName,
        geinamespace: "0",
        geilimit: "max",
      },
    });
    logger.info("Got embeddedin pages");
    for (const page in queryResult) {
      const oldText = queryResult[page].revisions[0].slots.main.content;
      const newText = conversionOfTemplate(oldText);
      const data = await req.edit({
        pageId: page,
        text: newText,
        summary: `תב:${templateName} >> [[תב:גוף פלנטרי]]`,
      });
      logger.info(`Edited page: ${queryResult[page].title}`, data);
    }
  } catch (error) {
    logger.error(error);
    console.error(error);
  }
}

/**
 *
 * @param {string} text
 * @returns {String}
 */
function conversionOfTemplate(text) {
  const templateText = findTemplate(text, templateName);
  const templateData = getTemplateKeyValueData(templateText);
  if (templateData["שטח פנים"])
    templateData["שטח פנים"] = templateData["שטח פנים"].replace('קמ"ר', "");
  templateData["שם כוכב"] = "השמש";
  templateData["סוג"] = `[[${templateName}]]`;
  replaceParams(templateData, 'אפהליון בק"מ', 'אפואפסיד בק"מ');
  replaceParams(templateData, "אפהליון יחידות אסטרונומיות", "אפואפסיד יחידות אסטרונומיות");
  replaceParams(templateData, 'פריהליון בק"מ', 'פריאפסיד בק"מ');
  replaceParams(templateData, "פריהליון יחידות אסטרונומיות", "פריאפסיד יחידות אסטרונומיות");
  Object.keys(templateData).forEach((key) => {
    if (templateData[key] === "") delete templateData[key];
  });

  const newTemplateText = templateFromKeyValueData(templateData, "גוף פלנטרי");
  return text.replace(templateText, newTemplateText);
}

function replaceParams(obj, oldP, newP) {
  if (!obj.hasOwnProperty(oldP) || obj[oldP] === undefined) return;
  obj[newP] = obj[oldP];
  delete obj[oldP];
}

main();
