import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// createTionaryPage -> applyReplacements fetches default replacements over
// the network; mock the requests module (and logger) as in utils.test.js.
jest.unstable_mockModule('../../src/requests/requests.js', () => ({
  getRequestsInstance: jest.fn(),
}));
jest.unstable_mockModule('../../src/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { getRequestsInstance } = await import('../../src/requests/requests.js');
const { default: createTionaryPage } = await import('../../src/import/bot_pages.js');

describe('createTionaryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRequestsInstance.mockReturnValue({
      parse: jest.fn().mockResolvedValue({
        parse: { wikitext: { '*': JSON.stringify([]) } },
      }),
    });
  });

  test('keeps the article body (the text from applyReplacements, not its result object)', async () => {
    const data = {
      text: "'''פלוני''' הוא כדורגלן.\n[[קטגוריה:כדורגלנים]]",
      properties: [{ name: 'defaultsort', '*': 'פלוני' }],
    };

    const text = await createTionaryPage(data, 'ספורט');

    expect(text).toBe(
      "'''פלוני''' הוא כדורגלן.\n[[קטגוריה:כדורגלנים]]" +
        '\n{{מיון רגיל:פלוני}}' +
        '\n[[קטגוריה:כדורגלנים]]' +
        '\n{{בוט ספורט}}'
    );
  });

  test('applies its own image replacements to the body', async () => {
    const text = await createTionaryPage(
      { text: 'גוף הערך [[קובץ:תמונה.jpg|ממוזער|כיתוב]] סוף' },
      'מוזיקה'
    );

    expect(text).toBe('גוף הערך  סוף\n{{בוט מוזיקה}}');
  });
});
