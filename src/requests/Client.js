import fetch from "node-fetch";
import dotenv from "dotenv";
import { CookieJar } from "tough-cookie";
dotenv.config();
import logger from "../logger.js";
import { loadConfig, mergeConfig } from "../config.js";

/**
 * client for mediawiki wiki api,
 * use only with A user with bot rights,
 * create A sub user with [[Special:BotPasswords]],
 * instruction see in {@link https://www.mediawiki.org/wiki/Manual:Bot_passwords}
 *
 * Alternatively, this client supports MediaWiki OAuth 2.0 owner-only consumers
 * (personal access tokens), see {@link https://www.mediawiki.org/wiki/OAuth/Owner-only_consumers}.
 * @class Client
 */
class WikiClient {
  wikiUrl;
  userName = "";
  #password = "";
  #oauthToken = "";
  token = {};
  isLoggedIn = false;
  #cookieJar;

  /**
   * Creates a MediaWiki API client.
   *
   * Settings are resolved with the following precedence (highest to lowest):
   * explicit constructor options > environment variables (`MC_USER`, `MC_PASSWORD`,
   * `MC_OAUTH_TOKEN`, `MC_CONFIG_PATH`) > config file (see `configPath`) > built-in defaults.
   *
   * @param {Object} options - Options object for configuration (recommended)
   * @param {string} [options.wikiUrl] - The URL of the wiki API (required, unless provided via config file)
   * @param {number} [options.maxlag=5] - Maximum lag parameter for MediaWiki API
   * @param {number} [options.maxRetries=3] - Maximum number of retries for failed requests
   * @param {boolean} [options.withLogedIn=true] - Whether to login automatically before requests
   * @param {string} [options.userAgent="hamichlol-bot"] - User agent string for requests
   * @param {string} [options.oauthToken] - MediaWiki OAuth 2.0 (owner-only consumer) access token. Also readable from `MC_OAUTH_TOKEN`.
   * @param {string} [options.configPath] - Path to a JSON config file with any of the above settings. Also readable from `MC_CONFIG_PATH`. If omitted, `./hamichlol-bot.config.json` is used when it exists.
   * @param {string} [wikiUrl] -  Passing a string as the first parameter is deprecated. Use an options object instead.
   * @param {number} [maxlag] -  For backward compatibility only.
   * @param {number} [maxRetries] -  For backward compatibility only.
   * @param {boolean} [withLogedIn] -  For backward compatibility only.
   * @param {string} [userAgent] -  For backward compatibility only.
   * @param {Object} [proxyOptions] -  For backward compatibility only.
   *
   * @example
   * // Recommended usage:
   * const client = new WikiClient({
   *   wikiUrl: "https://www.hamichlol.org.il/w/api.php",
   *   maxlag: 5,
   *   maxRetries: 3,
   *   withLogedIn: true,
   *   userAgent: "my-bot",
   * });
   *
   * // OAuth (owner-only consumer) usage:
   * const client = new WikiClient({
   *   wikiUrl: "https://www.hamichlol.org.il/w/api.php",
   *   oauthToken: process.env.MC_OAUTH_TOKEN,
   * });
   *
   * // Deprecated usage:
   * const client = new WikiClient("https://www.hamichlol.org.il/w/api.php");
   */
  constructor(options, maxlag, maxRetries, withLogedIn, userAgent, proxyOptions) {
    // Backward compatibility: if first param is string, treat as old signature
    if (typeof options === 'string') {
      options = {
        wikiUrl: options,
        maxlag,
        maxRetries,
        withLogedIn,
        userAgent,
      };
    }
    options = options || {};

    const fileConfig = loadConfig({ configPath: options.configPath });
    const merged = mergeConfig(options, fileConfig);

    if (!merged.wikiUrl) {
      throw new Error("you didn't pass the url of your wiki");
    }
    this.wikiUrl = merged.wikiUrl;
    this.isLoggedIn = false;
    this.withLogedIn = merged.withLogedIn !== undefined ? merged.withLogedIn : true;
    this.maxlag = merged.maxlag !== undefined ? merged.maxlag : 5;
    this.maxRetries = merged.maxRetries !== undefined ? merged.maxRetries : 3;
    this.userAgent = merged.userAgent || "hamichlol-bot";
    this.#cookieJar = new CookieJar();

    // Resolve credentials using the same precedence rules as other settings
    // (explicit options > environment variables > config file's `auth` block).
    const fileAuth = fileConfig.auth || {};
    const mergedAuth = mergeConfig(
      { userName: options.userName, password: options.password, oauthToken: options.oauthToken },
      {
        userName: process.env.MC_USER || undefined,
        password: process.env.MC_PASSWORD || undefined,
        oauthToken: process.env.MC_OAUTH_TOKEN || undefined,
      },
      {
        userName: fileAuth.type !== "oauth" ? fileAuth.userName : undefined,
        password: fileAuth.type !== "oauth" ? fileAuth.password : undefined,
        oauthToken: fileAuth.type !== "password" ? fileAuth.oauthToken : undefined,
      }
    );

    this.userName = mergedAuth.userName || "";
    this.#password = mergedAuth.password || "";
    const oauthToken = mergedAuth.oauthToken || "";

    if (oauthToken) {
      if (this.userName || this.#password) {
        logger.info(
          "Both an OAuth token and username/password were provided; using OAuth and ignoring the BotPassword credentials."
        );
      }
      this.setOAuthToken(oauthToken);
    }
  }

  /**
   * Sets (or rotates) the MediaWiki OAuth 2.0 access token used for authentication.
   * When a token is set, the client is treated as already authenticated and the
   * BotPassword login flow is skipped.
   *
   * @param {string} token - The OAuth access token.
   */
  setOAuthToken(token) {
    this.#oauthToken = token || "";
    this.isLoggedIn = !!this.#oauthToken;
  }

  /**
   * Sends a request to the MediaWiki API.
   * @async
   * @private
   * @param {string} method - The HTTP method to use for the request.
   * @param {object} params - The object params the request URL.
   * @param {number} [retries=0] - The number of retries for failed requests.
   * @returns {Promise<Object>} The JSON response from the MediaWiki API.
   */
  async #request(method, params, retries = 0) {
    const url = new URL(this.wikiUrl);
    const searchParams = new URLSearchParams({ format: "json", utf8: 1, ...params });
    if (this.maxlag) {
      searchParams.append("maxlag", this.maxlag);
    }
    let response;
    try {
      // Get cookies for this URL
      const cookieString = await this.#cookieJar.getCookieString(url.toString());
      
      const fetchOptions = {
        headers: {
          "user-agent": this.userAgent || "hamichlol-bot",
          cookie: cookieString,
          ...(this.#oauthToken
            ? { Authorization: "Bearer " + this.#oauthToken }
            : {}),
        },
      };
      if (method === "GET") {
        url.search = searchParams;
        response = await fetch(url, fetchOptions);
      } else {
        const postOptions = {
          ...fetchOptions,
          headers: {
            ...fetchOptions.headers,
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          },
          method: "POST",
          credentials: "include",
          body: searchParams,
        };
        response = await fetch(url, postOptions);
      }
      if (!response.ok) {
        const retry = parseInt(response.headers.get("retry-after"));
        if (retry && retries < this.maxRetries) {
          logger.info(`Retrying fetch after ${retry} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, retry * 1000));
          return this.#request(method, params, retries + 1);
        } else if (retries >= this.maxRetries) {
          logger.error(
            `Max retries exceeded for ${url.toString()}, giving up...`,
            response
          );
          throw new Error(`Max retries exceeded for ${url.toString()}`);
        }
        const error = new Error(`HTTP error! status: ${response.status}`);
        logger.error(`Failed to fetch ${url.toString()}: ${error.message}`, response);
        throw error;
      }
      if (params.action === "login") {
        // Store cookies from login response
        const setCookieHeaders = response.headers.raw()["set-cookie"];
        if (setCookieHeaders) {
          for (const cookie of setCookieHeaders) {
            await this.#cookieJar.setCookie(cookie, url.toString());
          }
        }
      }

      const jsonResponse = await response.json();
      
      // Check for MediaWiki API errors (like maxlag)
      if (jsonResponse.error) {
        logger.warn(`MediaWiki API error received:`, {
          code: jsonResponse.error.code,
          info: jsonResponse.error.info,
          retries: retries,
          maxRetries: this.maxRetries
        });
        
        if (jsonResponse.error.code === 'maxlag' && retries < this.maxRetries) {
          const lagTime = jsonResponse.error.lag || 5; // Default to 5 seconds if lag time not specified
          logger.info(`MaxLag error: database lag detected (${jsonResponse.error.lag}s). Waiting ${lagTime} seconds before retry ${retries + 1}/${this.maxRetries}...`);
          await new Promise((resolve) => setTimeout(resolve, lagTime * 1000));
          return this.#request(method, params, retries + 1);
        }
        
        // For other rate limit related errors
        if (['ratelimited', 'actionthrottledtext'].includes(jsonResponse.error.code) && retries < this.maxRetries) {
          const waitTime = 30; // Default wait time for rate limit
          logger.info(`Rate limit error (${jsonResponse.error.code}): waiting ${waitTime} seconds before retry ${retries + 1}/${this.maxRetries}...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
          return this.#request(method, params, retries + 1);
        }
        
        // If we can't retry or this isn't a retryable error, we'll still return the response
        // The calling function can decide how to handle the error
      }
      
      return jsonResponse;
    } catch (error) {
      logger.error(`Error in #request: ${error.message}`, error);
      throw error;
    }
  }
  /**
   * Sends a POST request to the MediaWiki API with the provided body parameters.
   *
   * @async
   * @param {Object} body - An object containing the parameters to be sent in the request body.
   * @returns {Promise<Object>} The JSON response from the MediaWiki API.
   */
  async wikiPost(body) {
    return await this.#request("POST", body);
  }
  /**
   * Makes a GET request to a specified URL with an optional query string.
   *
   * @param {object} queryParams - The query string to be appended to the URL.
   * @returns {Promise<object>} - The response from the GET request in JSON format.
   */
  async wikiGet(queryParams) {
    if (!this.isLoggedIn && this.withLogedIn) {
      await this.login();
    }
    return await this.#request("GET", queryParams);
  }
  /**
   * method to login the user and get a cookie for forther operations
   * @param {String} [userName]
   * @param {String} [password]
   * @returns {Promise<Boolean>}
   */
  async login(userName, password, assert = "bot") {
    if (this.#oauthToken) {
      logger.info("OAuth token is configured; skipping BotPassword login.");
      this.isLoggedIn = true;
      return true;
    }
    if (userName) {
      this.userName = userName;
    }
    if (password) {
      this.#password = password;
    }
    if (!this.userName || !this.#password) {
      logger.error("you dinwt pass your user name or your password");
      throw new Error("you dinwt pass your user name or your password");
    }
    const { logintoken: lgtoken } = await this.#getToken("login");
    const loginParams = {
      action: "login",
      lgname: this.userName,
      lgpassword: this.#password,
      lgtoken,
    };
    try {
      const { login } = await this.wikiPost(loginParams);
      this.#password = "";

      if (!login.result || login.result !== "Success") {
        logger.error(`Error in login: ${login.message}`, login);
        this.isLoggedIn = false;
        return false;
      }
      logger.info("logged in successfully");
      this.token = await this.#getToken("csrf&assert=" + assert);

      this.isLoggedIn = true;
      return true;
    } catch (error) {
      throw new Error(error);
    }
  }
  /**
   * Logs out the current user from the MediaWiki API.
   * This method sends a logout request to the API using the stored token.
   * It logs the success or failure of the logout operation.
   *
   * For OAuth-authenticated clients this is a safe no-op, since there is no
   * server-side session to end.
   *
   * @async
   * @returns {Promise<void>} A promise that resolves when the logout process is complete.
   * @throws {Error} If there's an error during the logout process, it's caught and logged as a warning.
   */
  async logout() {
    if (this.#oauthToken) {
      logger.info("OAuth token is configured; logout() is a no-op.");
      return;
    }
    const logOutParams = {
      action: "logout",
      token: this.token,
    };
    this.wikiPost(logOutParams)
      .then(() => logger.info("loged out successfully"))
      .catch((err) => logger.warn(err));
  }
  /**
   *
   * @param {String} type
   * @returns {Promise<Object>}
   */
  /**
   * Retrieves a token from the MediaWiki API for a specified action type.
   * This private method handles the API request to get the token and updates the cookie if a new one is provided.
   *
   * @private
   * @async
   * @param {string} type - The type of token to retrieve (e.g., 'login', 'csrf', etc.).
   * @returns {Promise<Object|undefined>} An object containing the requested token, or undefined if an error occurs.
   * @throws {Error} Logs the error message if the token retrieval fails.
   */
  async #getToken(type) {
    try {
      const url = `${this.wikiUrl}?action=query&format=json&meta=tokens&type=${type}`;
      const cookieString = await this.#cookieJar.getCookieString(url);
      
      const res = await fetch(url, {
        headers: {
          cookie: cookieString || "",
          ...(this.#oauthToken
            ? { Authorization: "Bearer " + this.#oauthToken }
            : {}),
        },
        agent: this.proxyAgent || undefined,
      });
      const jsonRes = await res.json();

      if (res.headers.raw()["set-cookie"]) {
        const setCookieHeaders = res.headers.raw()["set-cookie"];
        for (const cookie of setCookieHeaders) {
          await this.#cookieJar.setCookie(cookie, url);
        }
      }
      return jsonRes.query.tokens;
    } catch (error) {
      logger.error(`Error in #getToken: ${error.message}`, error);
    }
  }

  async #checkToken(params) {
    const checkParams = { action: "checktoken", ...params };
    if (!checkParams.type) {
      checkParams.type = "csrf";
    }
    if (!checkParams.token) {
      const tokenKey = checkParams.type + "token";
      if (!this.token || !this.token[tokenKey]) {
        this.token = await this.#getToken(checkParams.type);
      }
      checkParams.token = this.token?.[tokenKey];
    }

    const { checktoken, error } = await this.wikiGet(checkParams);

    if (!checktoken || !checktoken.result) {
      logger.error("Failed to validate token");
    }
    if (!checktoken || checktoken.result !== "valid") {
      this.token = await this.#getToken(checkParams.type);
    }

    if (error) {
      logger.error(`Error in #checkToken: ${error.message}`, error);
      throw new Error(`Error in #checkToken: ${error.message}`);
    }
  }

  /**
   * Edits a page on the wiki using the MediaWiki API.
   *
   * @async
   * @param {Object} options - The options for editing the page.
   * @param {string} [options.title] - The title of the page to edit. Either title or pageId must be provided.
   * @param {number} [options.pageId] - The ID of the page to edit. Either title or pageId must be provided.
   * @param {string} options.text - The new content to set for the page.
   * @param {string} [options.summary=''] - A summary of the edit.
   * @param {boolean} [options.minor=true] - Whether the edit is minor.
   * @param {boolean} [options.bot=true] - Whether the edit is made by a bot.
   * @param {object} [options.otherParams] - Additional parameters to pass to the API.
   * @throws {Error} Throws an error if neither title nor pageId is provided, or if text is not provided.
   * @returns {Promise<Object>} A promise that resolves with the API response object.
   */
  async edit({
    title,
    pageId,
    text,
    summary = "",
    minor = true,
    bot = true,
    ...otherParams
  } = {}) {
    if (!title && !pageId) {
      logger.error(
        "you didn't pass the details of the article you want to edit"
      );
      throw new Error(
        "you didn't pass the details of the article you want to edit"
      );
    }
    if (!text) {
      logger.error("you didn't pass the text of the article you want to edit");
      throw new Error(
        "you didn't pass the text of the article you want to edit"
      );
    }

    if (!this.isLoggedIn) {
      await this.login();
    }

    await this.#checkToken();

    const editParams = Object.fromEntries(
      Object.entries({
        action: "edit",
        title,
        pageid: pageId,
        text,
        summary,
        minor: minor ? 1 : undefined,
        bot: bot ? 1 : undefined,
        token: this.token.csrftoken,
        ...otherParams,
      }).filter(([, v]) => v !== undefined)
    );

    try {
      const result = await this.wikiPost(editParams);
      if (result.error) {
        logger.error(`Edit failed: ${result.error.info}`, result);
        throw new Error(`Edit failed: ${result.error.info}`);
      }
      return result;
    } catch (error) {
      logger.error(`Error in edit: ${error.message}`);
      throw error;
    }
  }

  /**
   * method to delete article
   * @param {String} title
   * @param {String} [reason]
   */
  async delete(title, pageid, reason) {
    if (!this.isLoggedIn) await this.login();
    const deleteParams = {
      action: "delete",
      title,
      pageid,
      token: this.token.csrftoken,
      reason,
    };
    Object.keys(deleteParams).forEach((key) => {
      if (deleteParams[key] === undefined) delete deleteParams[key];
    });
    return await this.wikiPost(deleteParams);
  }
  /**
   * method for moving pages
   * @param {String} from
   * @param {String} to
   * @param {String} [reason]
   * @param {Object} [param3]
   * @param {Number} param3.movtalk
   * @param {Number} param3.movesubpages
   * @param {Number} param3.noredirect
   * @returns {Promise<String>}
   */
  async move(
    from,
    to,
    reason,
    { movetalk = 1, movesubpages = 1, noredirect = 0 }
  ) {
    if (!this.isLoggedIn) await this.login();
    const moveParams = {
      action: "move",
      from,
      to,
      reason,
      movetalk,
      movesubpages,
      noredirect,
      ignorewarnings: 1,
      token: this.token.csrftoken,
    };
    if (!movetalk) delete moveParams.movetalk;
    if (!movesubpages) delete moveParams.movesubpages;
    if (!noredirect) delete moveParams.noredirect;
    return await this.wikiPost(moveParams);
  }

  /**
   * Locks a page on the wiki using the MediaWiki API.
   *
   * @async
   * @param {Object} options - The options for locking the page.
   * @param {string} [options.title] - The title of the page to lock. Either title or pageId must be provided.
   * @param {number} [options.pageid] - The ID of the page to lock. Either title or pageId must be provided.
   * @param {string} options.level - The protection level to apply to the page.
   * @param {string} [options.reason] - The reason for locking the page.
   * @throws {Error} Throws an error if no lock level is provided or if neither title nor pageId is provided.
   * @returns {Promise<Object>} A promise that resolves with the API response object for the lock action.
   */
  async lockPage({ title, pageid, level, reason }) {
    if (!this.isLoggedIn) await this.login();
    if (!level) throw new Error("You must provide a lock level");
    const lockParams = {
      action: "aspaklaryalockdown",
      level,
      reason,
      token: this.token.csrftoken,
    };
    if (!pageid && !title) {
      throw new Error("You must provide a title or pageid");
    } else if (pageid) {
      lockParams.pageid = pageid;
    } else lockParams.title = title;
    return await this.wikiPost(lockParams);
  }
  async unDelete({ title, reason }) {
    const params = {
      action: "undelete",
      format: "json",
      title,
      reason,
      token: this.token,
      utf8: 1,
    };
    return await this.wikiPost(params);
  }
  async sendMail({ target, subject, text }) {
    const mailParams = {
      action: "emailuser",
      target,
      subject,
      text,
      token: target.token,
    };
    return await this.wikiPost(mailParams);
  }
  async sendMessageToTalkPage({ page, topic, content }) {
    const { csrftoken: token } = await this.#getToken("csrf&assert=bot");
    const flowParams = {
      action: "flow",
      submodule: "new-topic",
      page,
      token,
      nttopic: topic,
      ntcontent: content,
    };
    const parsed = await this.wikiPost(flowParams);
    if (parsed?.error?.code === "invalid-page") {
      return await this.edit({
        title: page,
        text: content + "~~" + "~",
        summary: topic,
        section: "new",
        sectiontitle: topic,
      });
    }
    return parsed?.flow ? parsed?.flow["new-topic"]?.status : parsed;
  }

  /**
   * Performs a rollback operation on a wiki page.
   *
   * @async
   * @param {string} user - The username of the user whose edits are to be rolled back.
   * @param {Object} options - The options for the rollback operation.
   * @param {number} [options.pageid] - The ID of the page to rollback.
   * @param {string} [options.title] - The title of the page to rollback.
   * @param {string} [options.summary] - A summary of the rollback operation.
   * @param {boolean} [options.markbot=true] - Whether to mark the edit as bot.
   * @returns {Promise<Object>} A promise that resolves with the API response for the rollback action.
   */
  async rollback(user, { pageid, title, summary, markbot = true }) {
    try {
      if (!this.isLoggedIn) await this.login();
      if (!this.token.rollback) {
        const { rollbacktoken } = await this.#getToken("rollback&assert=bot");
        if (rollbacktoken) {
          this.token.rollback = rollbacktoken;
        } else {
          logger.error("Unable to obtain rollback token");
          throw new Error("Unable to obtain rollback token");
        }
      }
      const params = {
        action: "rollback",
        user,
        token: this.token.rollback,
      };

      if (pageid) params.pageid = pageid;
      if (title) params.title = title;
      if (summary) params.summary = summary;
      if (!markbot) delete params.markbot;
      return await this.wikiPost(params);
    } catch (error) {
      logger.error("rollback filed", error);
      throw error;
    }
  }
}

export default WikiClient;