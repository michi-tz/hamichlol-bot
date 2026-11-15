// חלק מהקוד בתיקיה זו נלקח או הותאם ממאגר הקוד הפתוח: https://github.com/EladHeller/wiki-bot
// ראה קובץ CREDITS.md לפרטים נוספים
const thousandStr = '1000 (מספר)|אלף';
const millionStr = 'מיליון';
const milliardStr = 'מיליארד';

const currencyName = {
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
};

function prettyNumericValue(number, currencyCode = 'NIS') {
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

function getLocalDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(+date)) {
    return '';
  }
  return date.toLocaleString('he', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getLocalTimeAndDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(+date)) {
    return '';
  }
  return `${date.toLocaleString('he', {
    hour: '2-digit', minute: '2-digit',
  })}, ${getLocalDate(dateString)}`;
}

function getFullYear(year) {
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

function parseLocalDate(dateString, throwError = true) {
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

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export {
  currencyName,
  prettyNumericValue,
  getLocalDate,
  getLocalTimeAndDate,
  getFullYear,
  monthToNumber,
  parseLocalDate,
};
