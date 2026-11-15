import { getRequestsInstance } from "../../requests/requests.js";

const request = getRequestsInstance("hamichlol");
/**
 * Check if a article has been edited locally or filtered based on comments.
 *
 * @param {string} title - The title of the article to check.
 * @returns {Promise<boolean|string>} - Returns false if the article does not exist on the local site, "edited locally" if the article was edited locally, "Content filter" if article content has been filtered, or "Image filter" if article images have been filtered.
 */
export async function checkLocalEdits(title) {
  const arrCommentAspaclarya = ["הסרת תוכן", "גיור מונח", "עריכה יהודית"];
  const arrCommentPhotos = ["הסרת תמונה", "החלפת תמונה"];
  const { [title]: page } = await request.queryPages({
    titles: title,
    useIdsOrTitles: "titles",
    options: {
      prop: "categories|revisions|templates",
      clcategories:
        "קטגוריה:המכלול: ערכים שנוצרו במכלול|קטגוריה:המכלול: ערכים ששוכתבו או הורחבו במכלול",
      rvprop: "comment|tags",
      tltemplates: "תבנית:נערך במכלול",
    },
  });
  // A title that does not exist locally comes back as `{ title, missing: "" }`
  // (and without `revisions`), so treat it the same as no result at all.
  if (!page || "missing" in page || !Array.isArray(page.revisions)) {
    return false;
  }
  if (page.tltemplates > 0 || page.clcategories > 0) {
    return "Edited locally";
  }
  for (let i = 0; i < page.revisions.length; i++) {
    if (arrCommentAspaclarya.includes(page.revisions[i].coment)) {
      return "Content filter";
    }
    if (arrCommentPhotos.includes(page.revisions[i].comment)) {
      return "Photo filter";
    }
  }
}
