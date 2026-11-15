// GENERATED FILE - DO NOT EDIT.
// Run `npm run sync:parser` to regenerate it; local changes will be overwritten.
// Generated from https://github.com/EladHeller/wiki-bot@1f97761c8dcacb1457c51de976f91a1b14d50afb
// Original path: bot/utilities.ts
// Source: wiki-bot (github.com/EladHeller), ISC license. See src/parser/CREDITS.md.

const thousandStr = '1000 (מספר)|אלף';
const millionStr = 'מיליון';
const milliardStr = 'מיליארד';

export const currencyName = {
  EUR: 'אירו',
  NIS: 'שקל חדש|ש"ח',
  USD: 'דולר אמריקאי|דולר',
  ILS: 'שקל חדש|ש"ח',
  JPY: 'ין יפני',
  AUD: 'דולר אוסטרלי',
  INR: 'רופי הודי',
  HKD: 'דולר הונג קונגי',
  CNY: 'רנמינבי',
  IDR: 'רוּפּיה אינדונזית',
  CAD: 'דולר קנדי',
  DKK: 'כתר דני',
  KRW: 'וון דרום קוריאני',
  GBP: 'לירה שטרלינג',
  CHF: 'פרנק שווייצרי',
};

export function prettyNumericValue(number, currencyCode = 'NIS') {
  let orderOfMagmitude = '';
  let sumStr = '';
  if (number === '0') {
    sumStr = number;
  } else if (number.length < 4) {
    orderOfMagmitude = thousandStr;
    sumStr = number;
  } else if (number.length < 10) {
    orderOfMagmitude = number.length < 7 ? millionStr : milliardStr;
    sumStr = Math.round(Number(number.substring(0, 4)) / 10).toString();
    const remind = number.length % 3;
    if (remind) {
      sumStr = [sumStr.slice(0, remind), '.', sumStr.slice(remind)].join('');
    }
  } else {
    orderOfMagmitude = milliardStr;
    sumStr = Math.round(Number(number.substring(0, number.length - 5)) / 10).toLocaleString();
  }

  return `${sumStr}${orderOfMagmitude ? ` [[${orderOfMagmitude}]]` : ''} [[${currencyName[currencyCode]}]]`;
}

export function getLocalDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(+date)) {
    return '';
  }
  return date.toLocaleString('he', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function getLocalTimeAndDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(+date)) {
    return '';
  }
  return `${date.toLocaleString('he', {
    hour: '2-digit', minute: '2-digit',
  })}, ${getLocalDate(dateString)}`;
}

export function getFullYear(year) {
  if (year.length === 2) {
    const yearNumber = +year;
    if (yearNumber > 25) {
      return `19${year}`;
    }
    return `20${year}`;
  }
  return year;
}

const monthToNumber = {
  ינואר: '01',
  פברואר: '02',
  מרץ: '03',
  אפריל: '04',
  מאי: '05',
  יוני: '06',
  יולי: '07',
  אוגוסט: '08',
  ספטמבר: '09',
  אוקטובר: '10',
  נובמבר: '11',
  דצמבר: '12',
};

export function parseLocalDate(dateString, throwError = true) {
  const [day, month, year] = dateString.split(' ');
  if (!day || !month || !year) {
    if (throwError) {
      throw new Error('Invalid date');
    }
    return new Date('Error date');
  }
  const monthNumber = monthToNumber[month.replace('ב', '')];
  return new Date(`${year}-${monthNumber}-${day.padStart(2, '0')}`);
}

export async function promiseSequence(size, callbacks) {
  let batch = callbacks.splice(0, size);
  const results = [];

  while (batch.length > 0) {
    await Promise.all(batch.map(async (callback) => {
      try {
        const res = await callback();
        results.push(res);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
    }));
    batch = callbacks.splice(0, size);
  }
  return results;
}

export function objectToFormData(obj) {
  const fd = new URLSearchParams();
  Object.entries(obj).forEach(([key, val]) => fd.append(key, val));
  return fd;
}

export function objectToQueryString(obj) {
  return Object.entries(obj).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&');
}

export async function asyncGeneratorMapWithSequence(
  sequenceSize,
  generator,
  callback,
) {
  let res = { done: false, value: [] };
  const results = [];
  do {
    try {
      res = await generator.next();
      if (res.value) {
        results.push(...await promiseSequence(sequenceSize, res.value.map(callback)));
      }
    } catch (error) {
      console.log(error?.data || error?.message || error?.toString());
      if (global.continueObject) {
        console.log('continue', global.continueObject);
      }
    }
  } while (!res.done);

  return results;
}

export function encodeWikiUrl(title) {
  return encodeURIComponent(title.replace(/ /g, '_')).replace(/'/g, '%27');
}

const tensHebrewMapping = {
  10: 'י',
  20: 'כ',
  30: 'ל',
  40: 'מ',
  50: 'נ',
  60: 'ס',
  70: 'ע',
  80: 'פ',
  90: 'צ',
};

export function hebrewGimetriya(number) {
  if (number < 1 || number > 499) {
    throw new Error('Number should be between 1 and 499');
  }
  const unity = number % 10;
  let unityHebrew = unity > 0 ? String.fromCharCode('א'.charCodeAt(0) + unity - 1) : '';
  const tens = (number % 100) - unity;
  let tensHebrew = tens ? tensHebrewMapping[tens] : '';
  if (tens === 10 && (unity === 5 || unity === 6)) {
    tensHebrew = 'ט';
    unityHebrew = unity === 5 ? 'ו' : 'ז';
  }
  const hundreds = number - tens - unity;
  const hundredsHebrew = hundreds ? `${String.fromCharCode('ק'.charCodeAt(0) + hundreds / 100 - 1)}` : '';
  return `${hundredsHebrew}${tensHebrew}${unityHebrew}`;
}

export function fetchUrlLikeBrowser(url) {
  return fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'en-US,en;q=0.9,de;q=0.8,he;q=0.7,uk;q=0.6',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      priority: 'u=0, i',
      'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
      'sec-ch-ua-arch': '"arm"',
      'sec-ch-ua-bitness': '"64"',
      'sec-ch-ua-full-version': '"134.0.6998.89"',
      'sec-ch-ua-full-version-list': '"Chromium";v="134.0.6998.89", "Not:A-Brand";v="24.0.0.0", "Google Chrome";v="134.0.6998.89"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-model': '""',
      'sec-ch-ua-platform': '"macOS"',
      'sec-ch-ua-platform-version': '"15.3.2"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      Referrer: 'https://www.google.com',
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    body: null,
    method: 'GET',
  });
}

export function convertContentToWikiPage(content, revid, title) {
  return {
    title,
    pageid: 1,
    ns: 0,
    extlinks: [],
    revisions: [{
      revid,
      slots: {
        main: {
          '*': content,
          contentmodel: 'wikitext',
          contentformat: 'text/x-wiki',
        },
      },
      user: process.env.BOT_NAME,
      size: content.length,
    }],
  };
}

export function contentFromPage(page) {
  const content = page.revisions?.[0].slots?.main['*'];
  const revid = page.revisions?.[0].revid;
  return {
    content,
    revid,
  };
}

export async function firstPageOf(generator) {
  const { value } = await generator.next();
  return value;
}

export function getUserAgent() {
  const botName = process.env.BOT_NAME;
  const wikiBaseUrl = process.env.BASE_URL?.replace(/\/$/, '');
  return `${botName}/1.0 (${wikiBaseUrl}/wiki/User:${botName})`;
}
