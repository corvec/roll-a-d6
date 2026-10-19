import tokenize, { isFunctionCallToken, parseFunctionCallToken } from './formulaTokenizer.js';
import validateFormula from './validateFormula.js';
import * as formulaParser from './formulaParser/index.js';
import evaluateFormula from './evaluateFormula.js';
import { extractLookupTables } from './lookupTables.js';
import { getPropertyByPath, objectMakerReduceHelper } from './helpers.js';
import * as ErrorTypes from './errorTypes.js';
import type {
  MacroMap,
  RandomNumberGenerator,
  ResultEntry,
  RollLog,
  RPNTokenList,
  SideEffects,
  TableMap,
  TargetedCollection,
} from './types.js';

export interface ResultRange {
  /** The result when evaluated in this range */
  result: ResultEntry[];
  /** The name of the variable. Only present on the first range. */
  variable?: string;
  /** The lowest value for which this result is applicable */
  minValue: number;
  /** The highest value for which this result is applicable. Absent on the last range. */
  maxValue?: number;
  /** Side effects applied when evaluated in this range */
  sideEffects?: SideEffects;
}

/**
 * Determine the result given different values of a single input, and build the ResultRange to model
 * this. Input values from 0 up to (but not including) `maxRange` are probed; boundaries at or
 * above `maxRange` will not be discovered.
 *
 * NOTE: The passed `rolls` log is mutated - any additional rolls made while probing are appended
 * to it, so that every probe reuses the same underlying dice results.
 */
export const buildResultRange = (
  { expressions, macrosWithCertainty, tables = {}, rolls, uncertainValues, result, maxRange = 40, initialSideEffects, rng }: {
    expressions: RPNTokenList[];
    macrosWithCertainty: (value: number) => MacroMap;
    tables?: TableMap;
    rolls: RollLog;
    uncertainValues: string[];
    result: ResultEntry[];
    maxRange?: number;
    initialSideEffects: SideEffects;
    rng?: RandomNumberGenerator;
  },
): ResultRange[] =>
  [...Array(maxRange).keys()].reduce(
    (accum: ResultRange[], testValue) => {
      const { sideEffects, result: currentResult } = evaluateFormula({
        expressions,
        macros: macrosWithCertainty(testValue),
        tables,
        rolls, // don't need to pass a new one in because we mutate the old one
        rng,
      });
      if (currentResult.every((value, index) => value === accum.slice(-1)[0].result[index])) {
        return accum;
      }
      return [
        ...accum.slice(0, -1),
        {
          ...accum.slice(-1)[0],
          maxValue: testValue - 1,
        },
        {
          minValue: testValue,
          result: currentResult,
          sideEffects,
        },
      ];
    },
    [
      {
        variable: uncertainValues[0],
        minValue: 0,
        result,
        sideEffects: initialSideEffects,
      },
    ],
  );

export interface RolledFormula {
  /**
   * Either the results from evaluation OR an array of results at multiple
   * input values for a given variable
   */
  result: ResultEntry[] | ResultRange[];
  /** Log of all rolls made as part of the evaluation */
  rolls: RollLog;
  /** Side effects applied from this roll */
  sideEffects?: SideEffects;
  /** Macros that were included in the initial expression */
  macros?: MacroMap;
  /** All macros - expression, collection, and inline */
  allMacros?: MacroMap;
}

/**
 * Convert the targeted collections into addressable formulas
 * @example // returns {'ac@Defender': '15'}
 *   convertToFormulasMap({ Defender: { rolls: { ac: '15' }, collections: {} } })
 */
const convertToFormulasMap = (
  targetedCollections: Record<string, TargetedCollection>,
): Record<string, string> => {
  // taking advice from https://youtu.be/qaGjS7-qWzg
  const formulasMap: Record<string, string> = {};
  for (const [collectionName, { rolls }] of Object.entries(targetedCollections)) {
    for (const [rollName, roll] of Object.entries(rolls)) {
      const formula = typeof roll === 'string' ? roll : getPropertyByPath(roll, ['formula']) as string | undefined;
      if (formula) {
        formulasMap[`${rollName}@${collectionName}`] = formula;
      }
    }
  }
  return formulasMap;
};


/**
 * Walk the given clauses for table-call tokens and gather the formula rows of every
 * referenced table (including tables referenced from other tables' rows), so those
 * rows participate in macro resolution and unknown-variable checking.
 */
const collectTableExpressions = (
  clauses: RPNTokenList[],
  tables: TableMap,
): { rowExpressions: RPNTokenList[]; unknownTables: string[] } => {
  const referenced = new Set<string>();
  const unknown = new Set<string>();
  const rowExpressions: RPNTokenList[] = [];
  const queue = [...clauses];
  while (queue.length > 0) {
    const clause = queue.pop() as RPNTokenList;
    for (const token of clause) {
      if (!isFunctionCallToken(token)) {
        continue;
      }
      const { name } = parseFunctionCallToken(token);
      if (['max', 'min'].includes(name) || referenced.has(name) || unknown.has(name)) {
        continue;
      }
      if (!tables.hasOwnProperty(name)) {
        unknown.add(name);
        continue;
      }
      referenced.add(name);
      for (const entry of tables[name].entries) {
        if (entry.formula) {
          rowExpressions.push(entry.formula);
          queue.push(entry.formula);
        }
      }
    }
  }
  return { rowExpressions, unknownTables: [...unknown] };
};

export interface RollFormulaOptions {
  /**
   * When the formula contains an uncertain value ('?'), input values from 0 up to (but not
   * including) maxRange are probed to build the result ranges. Defaults to 40.
   */
  maxRange?: number;
  /**
   * Source of randomness for dice rolls; defaults to Math.random. Inject a seeded generator
   * for deterministic results.
   */
  rng?: RandomNumberGenerator;
}

/**
 * Validate, parse, and evaluate a formula, potentially pulling in collection data if needed
 * @param formula The base formula to roll
 * @param collectionFormulasMap Any helper functions that are available
 * @param targetedCollections Map of collection names to collection objects. For targeting.
 * @param options Evaluation options (maxRange, rng)
 * @throws {ErrorTypes.ValidationError} if the formula fails validation
 * @throws {ErrorTypes.UnknownVariablesError} if the formula references variables that are not
 *         assigned, not available as macros, and not marked as no-prompt (^) variables
 */
export const rollFormula = (
  formula: string,
  collectionFormulasMap: Record<string, string>,
  targetedCollections: Record<string, TargetedCollection> = {},
  options: RollFormulaOptions = {},
): RolledFormula => {
  const { maxRange, rng } = options;
  const validity = validateFormula(formula);
  if (validity.length > 0) {
    throw new ErrorTypes.ValidationError(validity);
  }
  const tokens = tokenize(formula) as string[];

  const { expressions, macros, unassignedVariables } = formulaParser.parseTokens(tokens);

  const fullCollectionFormulasMap = {
    ...collectionFormulasMap,
    ...convertToFormulasMap(targetedCollections),
  };
  // Lookup table definitions are parsed separately; they are not tokenizable formulas
  const { tables, formulas: plainCollectionFormulas } = extractLookupTables(fullCollectionFormulasMap);
  const usesCallSyntax = [...expressions, ...Object.values(macros)]
    .some(clause => clause.some(isFunctionCallToken));
  const macrosFromCollection = unassignedVariables.length > 0 || usesCallSyntax
    ? formulaParser.getMacrosFromCollection(plainCollectionFormulas)
    : {};

  // Repeat the analysis until it stabilizes: formula rows of referenced tables can
  // pull in macros, which can themselves reference further tables.
  let analysisExpressions = [...expressions];
  let variables: string[] = [];
  let usedMacros: MacroMap = {};
  for (let previousCount = -1; previousCount !== analysisExpressions.length;) {
    previousCount = analysisExpressions.length;
    ({ variables, usedMacros } = formulaParser.getUnassignedVariablesAndUsedMacros(
      analysisExpressions, macros, macrosFromCollection,
    ));
    const { rowExpressions, unknownTables } = collectTableExpressions(
      [...analysisExpressions, ...Object.values(usedMacros)], tables,
    );
    if (unknownTables.length > 0) {
      throw new ErrorTypes.UnknownVariablesError(unknownTables);
    }
    analysisExpressions = [...expressions, ...rowExpressions];
  }

  const noPromptVariables = variables.filter(variable =>
    [...Object.values(usedMacros), ...analysisExpressions].some(clause => clause.some(
      token => token === `^${variable}`,
    )));

  const missingVariables = variables.filter(variable =>
    !noPromptVariables.includes(variable) && !tables.hasOwnProperty(variable));
  if (missingVariables.length > 0) {
    throw new ErrorTypes.UnknownVariablesError(missingVariables);
  }

  const allMacros = {
    ...usedMacros,
    ...noPromptVariables.map((variable): [string, RPNTokenList] => [variable, ['0']])
      .reduce(objectMakerReduceHelper<RPNTokenList>, {}),
  };
  const uncertainValues = Object.entries(allMacros)
    .filter(([, macroTokens]) => macroTokens.length === 1 && macroTokens[0] === '?')
    .map(([macroName]) => macroName);
  if (uncertainValues.length > 1) {
    throw new Error('Multiple uncertain values are not yet supported.');
  }
  if (uncertainValues.length === 0) {
    const { result, rolls, sideEffects } = evaluateFormula({ expressions, macros: allMacros, tables, rng });
    return { result, rolls, sideEffects, allMacros, macros };
  }
  const macrosWithCertainty = (value: number): MacroMap => ({
    ...allMacros,
    [uncertainValues[0]]: [`${value}`],
  });
  const { result, rolls, sideEffects: initialSideEffects } = evaluateFormula({ expressions, macros: macrosWithCertainty(0), tables, rng });
  const resultRange = buildResultRange({ expressions, macrosWithCertainty, tables, result, rolls, uncertainValues, initialSideEffects, maxRange, rng });

  return { result: resultRange, rolls, allMacros, macros };
};

export default rollFormula;
