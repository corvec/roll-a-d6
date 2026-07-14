import tokenize from './formulaTokenizer.js';
import validateFormula from './validateFormula.js';
import * as formulaParser from './formulaParser/index.js';
import evaluateFormula from './evaluateFormula.js';
import { getPropertyByPath, objectMakerReduceHelper } from './helpers.js';
import * as ErrorTypes from './errorTypes.js';
import type {
  MacroMap,
  ResultEntry,
  RollLog,
  RPNTokenList,
  SideEffects,
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
 * this.
 */
export const buildResultRange = (
  { expressions, macrosWithCertainty, rolls, uncertainValues, result, maxRange = 40, initialSideEffects }: {
    expressions: RPNTokenList[];
    macrosWithCertainty: (value: number) => MacroMap;
    rolls: RollLog;
    uncertainValues: string[];
    result: ResultEntry[];
    maxRange?: number;
    initialSideEffects: SideEffects;
  },
): ResultRange[] =>
  [...Array(maxRange).keys()].reduce(
    (accum: ResultRange[], testValue) => {
      const { sideEffects, result: currentResult } = evaluateFormula({
        expressions,
        macros: macrosWithCertainty(testValue),
        rolls, // don't need to pass a new one in because we mutate the old one
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
  rolls: RollLog | [];
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
 * Validate, parse, and evaluate a formula, potentially pulling in collection data if needed
 * @param formula The base formula to roll
 * @param collectionFormulasMap Any helper functions that are available
 * @param targetedCollections Map of collection names to collection objects. For targeting.
 */
export const rollFormula = (
  formula: string,
  collectionFormulasMap: Record<string, string>,
  targetedCollections: Record<string, TargetedCollection> = {},
): RolledFormula => {
  const validity = validateFormula(formula);
  if (validity.length > 0) {
    return {
      result: [`Invalid formula! Issues: ${validity.join(', ')}`],
      rolls: [],
    };
  }
  const tokens = tokenize(formula) as string[];

  const { expressions, macros, unassignedVariables } = formulaParser.parseTokens(tokens);

  const fullCollectionFormulasMap = {
    ...collectionFormulasMap,
    ...convertToFormulasMap(targetedCollections),
  };
  const macrosFromCollection = unassignedVariables.length > 0
    ? formulaParser.getMacrosFromCollection(fullCollectionFormulasMap)
    : {};

  const { variables, usedMacros } = formulaParser.getUnassignedVariablesAndUsedMacros(
    expressions, macros, macrosFromCollection,
  );

  const noPromptVariables = variables.filter(variable =>
    [...Object.values(usedMacros), ...expressions].some(clause => clause.some(
      token => token === `^${variable}`,
    )));

  const missingVariables = variables.filter(variable => !noPromptVariables.includes(variable));
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
    const { result, rolls, sideEffects } = evaluateFormula({ expressions, macros: allMacros });
    return { result, rolls, sideEffects, allMacros, macros };
  }
  const macrosWithCertainty = (value: number): MacroMap => ({
    ...allMacros,
    [uncertainValues[0]]: [`${value}`],
  });
  const { result, rolls, sideEffects: initialSideEffects } = evaluateFormula({ expressions, macros: macrosWithCertainty(0) });
  const resultRange = buildResultRange({ expressions, macrosWithCertainty, result, rolls, uncertainValues, initialSideEffects });

  return { result: resultRange, rolls, allMacros, macros };
};

export default rollFormula;
