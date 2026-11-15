import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { mapIdsToNames } from '../../src/requests/utils/DataProcessor.js';

// check-local.js grabs a Requests instance at module load and calls
// queryPages(); mock it with a stand-in that reproduces the real return shape
// of Requests.queryPages: results keyed by pageid by default, keyed by title
// only when `useIdsOrTitles: "titles"` is passed.
const mockApiPages = {};
const queryPages = jest.fn(async ({ useIdsOrTitles = 'ids' }) =>
  useIdsOrTitles === 'ids' ? mockApiPages : mapIdsToNames(mockApiPages, 'title')
);
jest.unstable_mockModule('../../src/requests/requests.js', () => ({
  getRequestsInstance: jest.fn(() => ({ queryPages })),
}));

const { checkLocalEdits } = await import('../../src/import/check/check-local.js');

function setApiPages(pages) {
  for (const key of Object.keys(mockApiPages)) delete mockApiPages[key];
  Object.assign(mockApiPages, pages);
}

describe('checkLocalEdits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setApiPages({});
  });

  test('requests title-keyed results, since it looks the page up by title', async () => {
    setApiPages({ 42: { pageid: 42, title: 'ערך', revisions: [] } });

    await checkLocalEdits('ערך');

    expect(queryPages).toHaveBeenCalledWith(
      expect.objectContaining({ titles: 'ערך', useIdsOrTitles: 'titles' })
    );
  });

  test('finds the page by title and reports a photo filter from its revision comment', async () => {
    setApiPages({
      42: { pageid: 42, title: 'ערך', revisions: [{ comment: 'הסרת תמונה' }] },
    });

    await expect(checkLocalEdits('ערך')).resolves.toBe('Photo filter');
  });

  test('returns false when the page is not in the result at all', async () => {
    await expect(checkLocalEdits('ערך')).resolves.toBe(false);
  });

  test('returns false (instead of throwing) for a page reported as missing', async () => {
    setApiPages({ '-1': { ns: 0, title: 'ערך', missing: '' } });

    await expect(checkLocalEdits('ערך')).resolves.toBe(false);
  });

  test('returns false (instead of throwing) for a page without revisions', async () => {
    setApiPages({ 42: { pageid: 42, title: 'ערך' } });

    await expect(checkLocalEdits('ערך')).resolves.toBe(false);
  });
});
