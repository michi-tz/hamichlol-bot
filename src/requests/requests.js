
/**
 * @typedef {Object} RequestsOptions
 * @property {string} wikiUrl - The URL of the wiki API (required)
 * @property {number} [maxlag=5] - Maximum lag parameter for MediaWiki API
 * @property {number} [maxRetries=3] - Maximum number of retries for failed requests
 * @property {boolean} [withLogedIn=true] - Whether to login automatically before requests
 * @property {string} [userAgent="hamichlol-bot"] - User agent string for requests
 */

import WikiClient from "./Client.js";
import { mapIdsToNames, mergeResults } from "./utils/DataProcessor.js";
import logger from "../logger.js";

/**
 * Represents a class for making HTTP GET requests to a specified URL and retrieving data from a wiki.
 * @constructor
 * @param {string} urlGet - The URL of the wiki.
 * @throws {Error} Throws an error if the URL of the wiki is not provided.
 */
export class Requests extends WikiClient {
  wikiUrl = "";
  /**
   * Creates a Requests client for MediaWiki API.
   *
   * @param {RequestsOptions|string} options - Options object for configuration, or wikiUrl string for backward compatibility
   * @param {number} [maxlag] - Maximum lag (for backward compatibility)
   * @param {number} [maxRetries] - Maximum retries (for backward compatibility)
   * @param {boolean} [withLogedIn] - Whether to login automatically (for backward compatibility)
   * @param {string} [userAgent] - User agent string (for backward compatibility)
   *
   * @example
   * // Recommended usage:
   * const client = new Requests({
   *   wikiUrl: "https://www.hamichlol.org.il/w/api.php",
   *   maxlag: 5,
   *   maxRetries: 3,
   *   withLogedIn: true,
   *   userAgent: "my-bot",
   * });
   *
   * // Backward compatible usage:
   * const client = new Requests("https://www.hamichlol.org.il/w/api.php");
   */
  constructor(options, maxlag, maxRetries, withLogedIn, userAgent) {
    // Backward compatibility: if first param is string, treat as old signature
    let wikiUrl;
    if (typeof options === 'string') {
      wikiUrl = options;
      options = {
        wikiUrl,
        maxlag,
        maxRetries,
        withLogedIn,
        userAgent,
      };
    } else {
      wikiUrl = options?.wikiUrl;
    }
    if (!wikiUrl) {
      logger.error("you didn't pass the url of your wiki");
      throw new Error("you didn't pass the url of your wiki");
    }
    super(options);
    this.wikiUrl = wikiUrl;
  }

  /**
   * Queries pages from the wiki API based on provided titles or IDs.
   *
   * @async
   * @param {Object} params - The parameters for the query.
   * @param {string|string[]} [params.titles] - The titles of the pages to query. Can be a single title or an array of titles.
   * @param {string} [params.useIdsOrTitles="ids"] - Determines whether to return results using page IDs or titles. Can be "ids" or "titles".
   * @param {boolean} [params.getContinue=true] - Whether to automatically fetch all results using continuation.
   * @param {Object} [params.options={}] - Additional query parameters to be included in the request.
   * @param {string} [params.method="POST"] - The HTTP method to use for the request ("GET" or "POST", case-insensitive).
  * @returns {Promise<Object>} A promise that resolves to the query results. If useIdsOrTitles is "ids", it returns the raw query result. If "titles", it returns the result mapped from IDs to titles.
   */
  async queryPages({
    titles,
    useIdsOrTitles = "ids",
    getContinue = true,
    options = {},
    // POST by default: long `titles` lists can exceed URL length limits with GET.
    method = "POST"
  }) {
    const queryParams = {
      action: "query",
      format: "json",
      prop: "info",
      ...options,
    };
    if (titles) {
      queryParams.titles =
        typeof titles === "string" ? titles : titles.join("|");
    }
    const query = await this.query({
      options: queryParams,
      getContinue,
      method,
    });
    return useIdsOrTitles === "ids" ? query : mapIdsToNames(query, "title");
  }

  /**
   * Queries the wiki API for pages that embed (transclude) a specified page.
   *
   * @async
   * @param {Object} params - The parameters for the query.
   * @param {number} [params.pageid] - The ID of the page to find embeddings for. Mutually exclusive with 'title'.
   * @param {string} [params.title] - The title of the page to find embeddings for. Mutually exclusive with 'pageid'.
   * @param {boolean} [params.getContinue=true] - Whether to automatically fetch all results using continuation.
   * @param {Object} [params.options={}] - Additional query parameters to be included in the request.
   * @throws {Error} Throws an error if both pageid and title are provided.
   * @returns {Promise<Object>} A promise that resolves to the query results containing pages that embed the specified page.
   */
  async embeddedin({ pageid, title, getContinue = true, options = {} }) {
    const queryParams = {
      action: "query",
      format: "json",
      list: "embeddedin",
      einamespace: 0,
      eilimit: "max",
      ...options,
    };
    if (pageid && title) {
      const errorMsg = "you must provide either pageid or title";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (pageid) {
      queryParams.einpageid = pageid;
    } else if (title) {
      queryParams.eititle = title;
    } else {
      const errorMessage = "you must provide either pageid or title";
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    return await this.query({ options: queryParams, getContinue });
  }

  /**
   * Queries the wiki API for the members of a specific category.
   *
   * @param {Object} options - The options for the query request.
   * @param {string} options.categoryName - The name of the category whose members are to be queried.
   * @param {number} [options.categoryId] - The ID of the category whose members are to
   * @param {boolean} [options.getContinue=true] - A flag indicating whether to retrieve all results using continuation.
   * @param {Object} [options.options={}] - Additional options for the query request.
   * @returns {Promise<Object>} - A promise that resolves to the query result in JSON format.
   */
  async categoryMembers({
    categoryName,
    categoryId,
    getContinue = true,
    options = {},
  }) {
    const queryParams = {
      action: "query",
      format: "json",
      list: "categorymembers",
      cmnamespace: 0,
      cmlimit: "max",
      ...options,
    };
    if ((categoryId || options.categoryId) && categoryName) {
      const errorMessage = "you must provide either categoryId or categoryName";
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    if (categoryId) {
      queryParams.cmpageid = categoryId;
    } else {
      queryParams.cmtitle = `קטגוריה:${categoryName}`;
    }
    if (options.cmtype) {
      delete queryParams.cmnamespace;
    } else {
      delete options.cmtype;
    }

    return await this.query({
      options: queryParams,
      getContinue,
    });
  }

  /**
   * Parses a wiki page by making a GET request to the wiki API with the specified parameters.
   * @async
   * @param {string} params.page - The title of the wiki page to parse.
   * @param {number} params.pageid - The ID of the wiki page to parse.
   * @param {string} params.prop - The properties to include in the parsed data.
   * @param {number} params.section - The section number of the wiki page to parse.
   * @param {Object} params.options - Additional options for the parse request.
   * @returns {Promise<Object>} A promise that resolves to the parsed data in JSON format.
   */
  async parse({ page, pageid, prop, section, options = {} }) {
    const parseParams = {
      action: "parse",
      format: "json",
      utf8: 1,
      prop: prop || "wikitext",
      disableppupdate: 1,
      disableeditsection: 1,
      ...options,
    };
    if (page && pageid) {
      logger.error("you can't pass both page and pageid");
      throw new Error("you can't pass both page and pageid");
    }
    if (page) {
      parseParams.page = page;
    } else if (pageid) {
      parseParams.pageid = pageid;
    } else {
      const errorMessage = "you must pass either page or pageid";
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    if (section || section === 0) {
      parseParams.section = section;
    }
    return await super.wikiGet(parseParams);
  }

  /**
   * Performs a query to the wiki API using specified parameters.
   *
   * @async
   * @param {Object} params - The parameters for the query.
   * @param {Object} [params.options={}] - Additional options to be included in the query parameters.
   * @param {boolean} [params.getContinue=true] - Whether to automatically fetch all results using continuation.
   * @param {string} [method="GET"] - The HTTP method to use for the request.
  * @returns {Promise<Object>} A promise that resolves to the query result. If getContinue is true, it includes all paginated results.
   */
  async query({ options = {}, getContinue = true, method = "GET" }) {
    const queryParams = {
      action: "query",
      format: "json",
      utf8: 1,
      ...options,
    };

    const res = await (String(method).toUpperCase() === "GET"
      ? super.wikiGet(queryParams)
      : super.wikiPost(queryParams));
    if (!getContinue) {
      return res;
    } else {
      return await this.getWithContinue(queryParams, res, method);
    }
  }

  /**
   * Handles the continuation of a query in the wiki API.
   * @async
   * @param {object} queryParams - The query string for the GET request.
   * @param {object} data - The data from the previous query results.
   * @param {string} method - The HTTP method used for the query.
   * @returns {Promise} - The result of the final query.
   * @throws {Error} - If an error occurs during the process.
   */
  async getWithContinue(queryParams, data, method) {
    if (!data || !data.query) {
      const errorMessage = "data or query is not valid";
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    if (!queryParams) {
      const errorMessage = "the query params in getWithContinue is not valid";
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    let contin = data.continue;

    let results = mergeResults([], data);

    try {
      while (contin) {
        Object.assign(queryParams, contin);
        const res = await (String(method).toUpperCase() === "GET"
          ? super.wikiGet(queryParams)
          : super.wikiPost(queryParams));
        results = mergeResults(results, res);
        contin = res.continue;
      }
      return results;
    } catch (error) {
      logger.error(error);
      //console.error(error);
      //throw new Error(error);
    }
  }

  /**
   * Converts an object into a query string format.
   * @param {Object} obj - The object to be converted into a query string.
   * @returns {string} - The query string representation of the input object.
  #objectToQueryString(obj) {
    return Object.entries(obj)
    .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
    .join("&");
  }
  */
}

let instance = new Map();

/**
 * Get or create an instance of Requests.
 *
 * @param {string} [nameInstance="hamichlol"] - The name of the instance.
 * @param {string} wikiUrl - The URL to use for the requests.
 * @returns {Requests} An instance of the `Requests` class.
 */
export function getRequestsInstance(nameInstance = "hamichlol", wikiUrl) {
  wikiUrl = wikiUrl
    ? wikiUrl
    : nameInstance === "hamichlol"
    ? "https://www.hamichlol.org.il/w/api.php"
    : process.platform === "win32"
    ? "https://www.hamichlol.org.il/import/get_wik1i.php"
    : "https://he.wikipedia.org/w/api.php";
  if (!instance.has(nameInstance)) {
    logger.info("creating instance: " + nameInstance);
    instance.set(nameInstance, new Requests(wikiUrl));
  }
  return instance.get(nameInstance);
}
