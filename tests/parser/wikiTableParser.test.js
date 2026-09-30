import { describe, test, expect } from '@jest/globals';
import {
  getNextRowDelimiterIndex,
  getTableRow,
  findTablesText,
  tableTextToObject,
  buildTableRow,
  buildTable,
  buildTableWithStyle,
  parseTableText,
} from '../../src/parser/wikiTableParser.js';

const SIMPLE_TABLE = '{| class="wikitable"\n! A !! B\n|-\n| 1 || 2\n|-\n| 3 || 4\n|}';

describe('getNextRowDelimiterIndex', () => {
  test('finds a double-delimiter split within a row', () => {
    expect(getNextRowDelimiterIndex('a||b', 0, '|')).toBe(1);
  });

  test('returns -1 when there is no delimiter', () => {
    expect(getNextRowDelimiterIndex('nodelimiter', 0, '|')).toBe(-1);
  });

  test('finds a newline-prefixed delimiter split', () => {
    expect(getNextRowDelimiterIndex('a\n|b', 0, '|')).toBe(1);
  });
});

describe('getTableRow', () => {
  test('parses a simple header row', () => {
    expect(getTableRow('A !! B', true)).toEqual({ fields: ['A', 'B'], style: '' });
  });

  test('parses a simple data row', () => {
    expect(getTableRow('1 || 2', false)).toEqual({ fields: ['1', '2'], style: '' });
  });

  test('parses a single-field row', () => {
    expect(getTableRow('solo', false)).toEqual({ fields: ['solo'], style: '' });
  });
});

describe('findTablesText', () => {
  test('returns an empty array when there is no table', () => {
    expect(findTablesText('just plain text')).toEqual([]);
  });

  test('extracts a single table embedded in surrounding text', () => {
    const content = `before\n${SIMPLE_TABLE}\nafter`;
    expect(findTablesText(content)).toEqual([SIMPLE_TABLE]);
  });

  test('extracts multiple tables', () => {
    const content = `${SIMPLE_TABLE}\nmiddle\n${SIMPLE_TABLE}`;
    expect(findTablesText(content)).toHaveLength(2);
  });
});

describe('tableTextToObject', () => {
  test('parses table style, header and data rows', () => {
    const result = tableTextToObject(SIMPLE_TABLE);
    expect(result.tableStyle).toBe('class="wikitable"');
    expect(result.rows).toEqual([
      { fields: ['A', 'B'], style: '' },
      { fields: ['1', '2'], style: '' },
      { fields: ['3', '4'], style: '' },
    ]);
  });

  test('parses a table without a header row', () => {
    // NOTE: documenting existing behavior - the leading "{|" itself is
    // treated as an empty first data row before the "|-" row separator is
    // reached, so an extra `{ fields: [''], style: '' }` row is produced
    // ahead of the actual data row.
    const table = '{|\n|-\n| x || y\n|}';
    const result = tableTextToObject(table);
    expect(result.rows).toEqual([
      { fields: [''], style: '' },
      { fields: ['x', 'y'], style: '' },
    ]);
  });
});

describe('buildTableRow', () => {
  test('builds a data row with a single field', () => {
    expect(buildTableRow(['only'])).toBe('\n|-\n|only');
  });

  test('builds a data row with multiple fields, separated by " || "', () => {
    expect(buildTableRow(['a', 'b'])).toBe('\n|-\n|a || b');
  });

  test('renders null/undefined fields as "---"', () => {
    expect(buildTableRow(['a', null, undefined])).toBe('\n|-\n|a || --- || ---');
  });

  test('builds a header row when isHeader is true', () => {
    expect(buildTableRow(['H1', 'H2'], '', true)).toBe('\n|-\n!H1 || H2');
  });

  test('strips newlines from field values', () => {
    expect(buildTableRow(['line1\nline2'])).toBe('\n|-\n|line1line2');
  });
});

describe('buildTable / buildTableWithStyle', () => {
  test('builds a sortable wikitable by default', () => {
    const table = buildTable(['H1', 'H2'], [['a', 'b']]);
    expect(table).toContain('class="wikitable sortable"');
    expect(table).toContain('! H1 !! H2');
    expect(table.trim().endsWith('|}')).toBe(true);
  });

  test('omits "sortable" when sortable is false', () => {
    const table = buildTable(['H1'], [['a']], false);
    expect(table).toContain('class="wikitable"');
    expect(table).not.toContain('sortable');
  });

  test('buildTableWithStyle applies per-row style and header flags', () => {
    const table = buildTableWithStyle(['H1'], [
      { fields: ['v1'], style: ' class="x"', isHeader: true },
    ]);
    expect(table).toContain('!v1');
    expect(table).toContain('class="x"');
  });
});

describe('parseTableText (round trip)', () => {
  test('parses all tables found in an article body', () => {
    const article = `intro\n${SIMPLE_TABLE}\noutro`;
    const parsed = parseTableText(article);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].rows).toHaveLength(3);
  });

  test('returns an empty array for an article without tables', () => {
    expect(parseTableText('no tables here')).toEqual([]);
  });
});
