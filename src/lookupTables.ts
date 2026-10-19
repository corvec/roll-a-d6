/*
 * Lookup tables map a numeric selector (usually a dice roll) onto a result.
 *
 * A table is defined as a macro whose entire value is bracketed:
 * * Text tables use single brackets; each row's value is returned verbatim as a string:
 *   '[1-2: Goblin ambush, 3-5: Wolves, 6: Dragon]'
 * * Formula tables use double brackets; the selected row's value is a formula that is
 *   evaluated only when the row is selected:
 *   '[[1-2: 1d6, 3-5: 2d6+2, 6: 3d6!]]'
 *
 * Row selectors may be a single value ('3'), an inclusive range ('3-5'), an open range
 * ('6+'), or 'default' (used when no other row matches). The first matching row wins.
 *
 * Tables are used with call syntax: 'encounterTable(1d6)'.
 */

import { ValidationError } from './errorTypes.js';
import tokenize from './formulaTokenizer.js';
import convertToRPN from './rpnConverter.js';
import { validateClause } from './validateFormula.js';
import type { LookupTable, LookupTableEntry, RPNTokenList, TableMap } from './types.js';

/**
 * Is this macro definition a lookup table (text or formula)?
 * @example // returns true
 * isLookupTableDefinition('[1: Goblin, 2: Orc]')
 */
export const isLookupTableDefinition = (definition: string): boolean => {
  const trimmed = definition.trim();
  return trimmed.startsWith('[') && trimmed.endsWith(']');
};

const selectorPattern = /^(?:(\d+)\s*-\s*(\d+)|(\d+)\s*\+|(\d+)|default)$/;

const parseSelector = (
  selector: string, tableName: string,
): Pick<LookupTableEntry, 'min' | 'max'> => {
  const match = selector.match(selectorPattern);
  if (!match) {
    throw new ValidationError([
      `Invalid selector "${selector}" in lookup table "${tableName}" (use N, N-M, N+, or default)`,
    ]);
  }
  const [, rangeMin, rangeMax, openMin, single] = match;
  if (rangeMin !== undefined) {
    const min = parseInt(rangeMin, 10);
    const max = parseInt(rangeMax, 10);
    if (min > max) {
      throw new ValidationError([
        `Selector "${selector}" in lookup table "${tableName}" is reversed (${min} > ${max})`,
      ]);
    }
    return { min, max };
  }
  if (openMin !== undefined) {
    return { min: parseInt(openMin, 10), max: null };
  }
  if (single !== undefined) {
    const value = parseInt(single, 10);
    return { min: value, max: value };
  }
  return { min: null, max: null }; // 'default'
};

/**
 * Split a table body into rows at top-level commas (commas inside parentheses,
 * e.g., within a formula row's function call, do not split).
 */
const splitRows = (body: string): string[] => {
  const rows: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of body) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    }
    if (char === ',' && depth === 0) {
      rows.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  rows.push(current);
  return rows.map(row => row.trim()).filter(row => row.length > 0);
};

/**
 * Validate and convert one formula row's value into RPN.
 * @throws {ValidationError} when the row's formula is invalid
 */
const parseFormulaRow = (formula: string, rowDescriptor: string): RPNTokenList => {
  const issues = validateClause(formula, rowDescriptor);
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
  return convertToRPN(tokenize(formula) as string[]);
};

/**
 * Parse a lookup table definition into its rows.
 * @param name The table's name (used in error messages)
 * @param definition The raw table definition, e.g., '[1-2: Goblin, default: Nothing]'
 *                   or '[[1-2: 1d6, default: 0]]'
 * @throws {ValidationError} when the definition is not a well-formed table
 */
export const parseLookupTable = (
  name: string,
  definition: string,
): LookupTable => {
  const trimmed = definition.trim();
  const isFormulaTable = trimmed.startsWith('[[') && trimmed.endsWith(']]');
  const body = isFormulaTable ? trimmed.slice(2, -2) : trimmed.slice(1, -1);
  const rows = splitRows(body);
  if (rows.length === 0) {
    throw new ValidationError([`Lookup table "${name}" has no rows`]);
  }
  const entries = rows.map((row): LookupTableEntry => {
    const colonIndex = row.indexOf(':');
    if (colonIndex < 0) {
      throw new ValidationError([`Row "${row}" in lookup table "${name}" is missing a ':' between selector and value`]);
    }
    const selector = row.slice(0, colonIndex).trim();
    const value = row.slice(colonIndex + 1).trim();
    if (value.length === 0) {
      throw new ValidationError([`Row "${row}" in lookup table "${name}" has no value`]);
    }
    const bounds = parseSelector(selector, name);
    return isFormulaTable
      ? { ...bounds, formula: parseFormulaRow(value, `${name}[${selector}]`) }
      : { ...bounds, text: value };
  });
  return { kind: isFormulaTable ? 'formula' : 'text', entries };
};

/**
 * Find the row of a table that matches the given selector value: the first row whose
 * range contains the value, or the first 'default' row when none does.
 * @throws {Error} when no row matches and the table has no default row
 */
export const lookUpEntry = (table: LookupTable, name: string, value: number): LookupTableEntry => {
  const entry = table.entries.find(
    ({ min, max }) => min !== null && value >= min && (max === null || value <= max),
  ) ?? table.entries.find(({ min }) => min === null);
  if (!entry) {
    throw new Error(`No row in lookup table "${name}" matches ${value}, and the table has no default row.`);
  }
  return entry;
};

/**
 * Partition a map of macro definitions into lookup tables and plain formulas.
 */
export const extractLookupTables = (
  formulasMap: Record<string, string>,
): { tables: TableMap; formulas: Record<string, string> } => {
  const tables: TableMap = {};
  const formulas: Record<string, string> = {};
  for (const [name, definition] of Object.entries(formulasMap)) {
    if (isLookupTableDefinition(definition)) {
      tables[name] = parseLookupTable(name, definition);
    } else {
      formulas[name] = definition;
    }
  }
  return { tables, formulas };
};
