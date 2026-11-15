// LOCAL FILE - not synced from upstream.
// Polyfill for RegExp.escape (ES2025). Upstream wiki-bot uses it, but it only
// exists natively from Node.js 24. `npm run sync:parser` adds
// `import './regexpEscapePolyfill.js';` to every generated file that uses
// RegExp.escape (see "polyfills" in upstream.json). It does nothing when the
// runtime already provides RegExp.escape.

const SYNTAX_CHARACTERS = '^$\\.*+?()[]{}|/';
const OTHER_PUNCTUATORS = ',-=<>#&!%:;@~\'`"';
const CONTROL_ESCAPES = {
  '\t': 't', '\n': 'n', '\v': 'v', '\f': 'f', '\r': 'r',
};

function hexEscape(codeUnit) {
  return codeUnit <= 0xff
    ? `\\x${codeUnit.toString(16).padStart(2, '0')}`
    : `\\u${codeUnit.toString(16).padStart(4, '0')}`;
}

/**
 * Spec-compliant implementation of RegExp.escape
 * (https://tc39.es/ecma262/#sec-regexp.escape).
 * @param {string} string
 * @returns {string}
 */
export function regExpEscape(string) {
  if (typeof string !== 'string') {
    throw new TypeError('RegExp.escape requires a string');
  }
  let escaped = '';
  for (const char of string) {
    const codePoint = char.codePointAt(0);
    if (escaped === '' && /^[0-9A-Za-z]$/.test(char)) {
      escaped += hexEscape(codePoint);
    } else if (SYNTAX_CHARACTERS.includes(char)) {
      escaped += `\\${char}`;
    } else if (Object.hasOwn(CONTROL_ESCAPES, char)) {
      escaped += `\\${CONTROL_ESCAPES[char]}`;
    } else if (OTHER_PUNCTUATORS.includes(char) || /^\s$/u.test(char)
      || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      escaped += codePoint <= 0xff ? hexEscape(codePoint) : hexEscape(char.charCodeAt(0));
    } else {
      escaped += char;
    }
  }
  return escaped;
}

if (typeof RegExp.escape !== 'function') {
  Object.defineProperty(RegExp, 'escape', {
    value: function escape(string) { return regExpEscape(string); },
    writable: true,
    enumerable: false,
    configurable: true,
  });
}
