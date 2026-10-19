import { extractLookupTables, isLookupTableDefinition, lookUpEntry, parseLookupTable } from './lookupTables.js';
import { ValidationError } from './errorTypes.js';

describe('isLookupTableDefinition', () => {
  it('detects bracketed definitions', () => {
    expect(isLookupTableDefinition('[1: Goblin, 2: Orc]')).toBe(true);
    expect(isLookupTableDefinition(' [[1: 1d6, 2: 2d6]] ')).toBe(true);
    expect(isLookupTableDefinition('1d20+5')).toBe(false);
    expect(isLookupTableDefinition('atk[0]')).toBe(false);
  });
});

describe('parseLookupTable (text)', () => {
  it('parses single values, ranges, open ranges, and default', () => {
    const table = parseLookupTable('t', '[1: Goblin, 2-3: Orc, 4+: Troll, default: Nothing]');
    expect(table.kind).toBe('text');
    expect(table.entries).toEqual([
      { min: 1, max: 1, text: 'Goblin' },
      { min: 2, max: 3, text: 'Orc' },
      { min: 4, max: null, text: 'Troll' },
      { min: null, max: null, text: 'Nothing' },
    ]);
  });

  it('preserves interior spacing of text values', () => {
    const table = parseLookupTable('t', '[1: a goblin ambush at night]');
    expect(table.entries[0].text).toBe('a goblin ambush at night');
  });

  it('rejects malformed tables', () => {
    expect(() => parseLookupTable('t', '[]')).toThrow(ValidationError);
    expect(() => parseLookupTable('t', '[1 Goblin]')).toThrow(/missing a ':'/);
    expect(() => parseLookupTable('t', '[x: Goblin]')).toThrow(/Invalid selector/);
    expect(() => parseLookupTable('t', '[5-2: Goblin]')).toThrow(/reversed/);
    expect(() => parseLookupTable('t', '[1: ]')).toThrow(/no value/);
  });
});

describe('lookUpEntry', () => {
  const table = parseLookupTable('t', '[1-2: low, 3-4: mid, 5+: high]');

  it('finds the first matching row', () => {
    expect(lookUpEntry(table, 't', 1).text).toBe('low');
    expect(lookUpEntry(table, 't', 2).text).toBe('low');
    expect(lookUpEntry(table, 't', 3).text).toBe('mid');
    expect(lookUpEntry(table, 't', 99).text).toBe('high');
  });

  it('falls back to the default row', () => {
    const withDefault = parseLookupTable('t', '[2: two, default: other]');
    expect(lookUpEntry(withDefault, 't', 5).text).toBe('other');
  });

  it('throws when nothing matches and there is no default', () => {
    expect(() => lookUpEntry(table, 't', 0)).toThrow(/no default row/);
  });
});

describe('extractLookupTables', () => {
  it('partitions tables from plain formulas', () => {
    const { tables, formulas } = extractLookupTables({
      encounter: '[1: Goblin, 2: Orc]',
      Strength: '5',
    });
    expect(Object.keys(tables)).toEqual(['encounter']);
    expect(formulas).toEqual({ Strength: '5' });
  });
});

describe('parseLookupTable (formula)', () => {
  it('parses double-bracketed tables into RPN rows', () => {
    const table = parseLookupTable('dmg', '[[1-2: 1d6, 3-5: 2d6+2, 6: 3d6!]]');
    expect(table.kind).toBe('formula');
    expect(table.entries).toEqual([
      { min: 1, max: 2, formula: ['1d6'] },
      { min: 3, max: 5, formula: ['2d6', '2', '+'] },
      { min: 6, max: 6, formula: ['3d6!'] },
    ]);
  });

  it('allows function calls with commas inside a row', () => {
    const table = parseLookupTable('t', '[[1: max(1d6,3), default: 0]]');
    expect(table.entries[0].formula).toEqual(['1d6', '3', 'max:2']);
  });

  it('rejects rows with invalid formulas', () => {
    expect(() => parseLookupTable('t', '[[1: 1d6+]]')).toThrow(ValidationError);
  });
});
