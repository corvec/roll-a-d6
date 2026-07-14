import { isVariable, isVariableInstance, stripPrefix, stripSuffix } from '../formulaTokenizer.js';
import { objectMakerReduceHelper } from '../helpers.js';
import type { CollectionRoll, MacroCollection, MacroMap, RPNTokenList } from '../types.js';

/**
 * Returns a reducer helper that will, given a list of already known variables, return a list of
 * any variables not already listed.
 *
 * @param variables The variables that are already known
 */
const getNewVariablesReduceHelper = (variables: MacroMap = {}) =>
  (accum: string[], expressions: RPNTokenList): string[] => [...new Set([
    ...accum,
    ...expressions.filter(token => isVariable(token))
      .map(stripPrefix)
      .filter(variable => !variables.hasOwnProperty(variable)),
    ...expressions.filter(token => isVariableInstance(token))
      .map(stripPrefix)
      .map(stripSuffix)
      .filter(variable => !variables.hasOwnProperty(variable)),
  ])];


const getUnassignedVariablesAndUsedMacrosHelper = (
  expressions: RPNTokenList[],
  usedMacros: MacroMap,
  unusedMacros: MacroCollection,
): UnassignedVariablesAndUsedMacros => {
  const rpn = [...expressions, ...Object.values(usedMacros)];
  const variables = rpn.reduce(getNewVariablesReduceHelper(usedMacros), []);
  if (variables.length === 0) {
    return { variables, usedMacros };
  }
  const newUsedMacros = variables.reduce(
    (accum, variable) => (
      unusedMacros.hasOwnProperty(variable)
        ? {
          ...unusedMacros[variable].helpers,
          ...accum,
          [variable]: unusedMacros[variable].formula,
        }
        : accum
    ),
    usedMacros,
  );
  if (Object.keys(newUsedMacros).length === Object.keys(usedMacros).length) {
    return { variables, usedMacros };
  }
  const newUnusedMacros = Object.entries(unusedMacros)
    .filter(([key]) => !newUsedMacros.hasOwnProperty(key))
    .reduce(objectMakerReduceHelper<CollectionRoll>, {});

  return getUnassignedVariablesAndUsedMacrosHelper(expressions, newUsedMacros, newUnusedMacros);
};

export interface UnassignedVariablesAndUsedMacros {
  /** The unassigned variables */
  variables: string[];
  /** Macros that have been referenced and that thus need to be pulled in */
  usedMacros: MacroMap;
}

/**
 * Given one or more expressions, determine which macros are needed, and pull in only those.
 *
 * @param expressions The expressions that are being evaluated.
 * @param macros Macros internal to the expression
 * @param macrosFromCollection Macros available from collections
 */
const getUnassignedVariablesAndUsedMacros = (
  expressions: RPNTokenList[],
  macros: MacroMap,
  macrosFromCollection: MacroCollection = {},
): UnassignedVariablesAndUsedMacros => {
  const unusedMacros: MacroCollection = {
    ...macrosFromCollection,
    ...Object.entries(macros).map(
      ([macroName, formula]): [string, CollectionRoll] => [macroName, { formula, helpers: {} }])
      .reduce(objectMakerReduceHelper, {}),
  };
  return getUnassignedVariablesAndUsedMacrosHelper(expressions, {}, unusedMacros);
};

export default getUnassignedVariablesAndUsedMacros;
