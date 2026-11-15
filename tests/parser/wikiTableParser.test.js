import { describe, test, expect } from '@jest/globals';
import parseTableText, {
  buildTableRow,
  buildTable,
  buildTableWithStyle,
} from '../../src/parser/wikiTableParser.js';
import * as wikiTableParser from '../../src/parser/wikiTableParser.js';

const SIMPLE_TABLE = '{| class="wikitable"\n! A !! B\n|-\n| 1 || 2\n|-\n| 3 || 4\n|}';

// Upstream made getNextRowDelimiterIndex, getTableRow, findTablesText and
// tableTextToObject module-private and turned parseTableText into the
// default export, so the row/table parsing behaviour that used to be tested
// on those helpers is tested through parseTableText. Rows now also carry an
// `isHeader` flag.

const parseSingle = (tableText) => {
  const tables = parseTableText(tableText);
  expect(tables).toHaveLength(1);
  return tables[0];
};

describe('module exports', () => {
  test('exposes parseTableText as the default export and the builders as named exports', () => {
    expect(Object.keys(wikiTableParser).sort()).toEqual(
      ['buildTable', 'buildTableRow', 'buildTableWithStyle', 'default'],
    );
  });
});

describe('row parsing (formerly getTableRow / getNextRowDelimiterIndex)', () => {
  test('splits a header row on "!!" and a data row on "||"', () => {
    expect(parseSingle(SIMPLE_TABLE).rows.slice(0, 2)).toEqual([
      { fields: ['A', 'B'], style: '', isHeader: true },
      { fields: ['1', '2'], style: '', isHeader: false },
    ]);
  });

  test('splits cells given on separate "|" lines and keeps single-field rows', () => {
    const { rows } = parseSingle('{|\n|-\n| a\n| b\n|-\n| solo\n|}');
    expect(rows.slice(1)).toEqual([
      { fields: ['a', 'b'], style: '', isHeader: false },
      { fields: ['solo'], style: '', isHeader: false },
    ]);
  });

  test('reads a row style cell', () => {
    const { rows } = parseSingle('{|\n|-\n| style="c" | a || b\n|}');
    expect(rows[1]).toEqual({ fields: ['a', 'b'], style: 'style="c"', isHeader: false });
  });

  test('does not split on delimiters inside templates or links', () => {
    const { rows } = parseSingle('{|\n|-\n| {{t|x}} || [[a|b]]\n|}');
    expect(rows[1].fields).toEqual(['{{t|x}}', '[[a|b]]']);
  });
});

describe('finding tables (formerly findTablesText)', () => {
  test('returns an empty array when there is no table', () => {
    expect(parseTableText('just plain text')).toEqual([]);
  });

  test('extracts a single table embedded in surrounding text', () => {
    const content = `before\n${SIMPLE_TABLE}\nafter`;
    expect(parseTableText(content).map(({ text }) => text)).toEqual([SIMPLE_TABLE]);
  });

  test('extracts multiple tables', () => {
    const content = `${SIMPLE_TABLE}\nmiddle\n${SIMPLE_TABLE}`;
    expect(parseTableText(content).map(({ text }) => text)).toEqual([SIMPLE_TABLE, SIMPLE_TABLE]);
  });
});

describe('table parsing (formerly tableTextToObject)', () => {
  test('parses table style, header and data rows', () => {
    expect(parseSingle(SIMPLE_TABLE)).toEqual({
      text: SIMPLE_TABLE,
      tableStyle: 'class="wikitable"',
      rows: [
        { fields: ['A', 'B'], style: '', isHeader: true },
        { fields: ['1', '2'], style: '', isHeader: false },
        { fields: ['3', '4'], style: '', isHeader: false },
      ],
    });
  });

  test('parses a table without a header row', () => {
    // NOTE: documenting existing behavior - the leading "{|" itself is
    // treated as an empty first data row before the "|-" row separator is
    // reached, so an extra `{ fields: [''] }` row is produced ahead of the
    // actual data row.
    const result = parseSingle('{|\n|-\n| x || y\n|}');
    expect(result.rows).toEqual([
      { fields: [''], style: '', isHeader: false },
      { fields: ['x', 'y'], style: '', isHeader: false },
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

  test('a built table parses back to the same cells', () => {
    const [parsed] = parseTableText(buildTable(['H1', 'H2'], [['a', 'b'], ['c', 'd']]));
    expect(parsed.rows.map(({ fields }) => fields)).toEqual([['H1', 'H2'], ['a', 'b'], ['c', 'd']]);
  });

  test('returns an empty array for an article without tables', () => {
    expect(parseTableText('no tables here')).toEqual([]);
  });
});
