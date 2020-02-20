import { isVariable, isVariableInstance, stripPrefix, stripSuffix } from '../formulaTokenizer';
import { objectMakerReduceHelper } from '../helpers';

/**
 * @function reduceHelper
 * @param {string[]} accum
 * @param {tokenList[]} expressions
 * @returns {@string[]}
 */

/**
 * Returns a reducer helper that will, given a list of already known variables, return a list of
 * any variables not already listed.
 *
 * @param {string[]} variables The variables that are already known
 * @returns {reduceHelper}
 */
const getNewVariablesReduceHelper = (variables = {}) =>
  (accum, expressions) => [...new Set([
    ...accum,
    ...expressions.filter(token => isVariable(token))
      .map(stripPrefix)
      .filter(variable => !variables.hasOwnProperty(variable)),
    ...expressions.filter(token => isVariableInstance(token))
      .map(stripPrefix)
      .map(stripSuffix)
      .filter(variable => !variables.hasOwnProperty(variable)),
  ])];


const getUnassignedVariablesAndUsedMacrosHelper = (expressions, usedMacros, unusedMacros) => {
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
    )
    , usedMacros);
  if (Object.keys(newUsedMacros).length === Object.keys(usedMacros).length) {
    return { variables, usedMacros };
  }
  const newUnusedMacros = Object.entries(unusedMacros)
    .filter(([key]) => !newUsedMacros.hasOwnProperty(key))
    .reduce(objectMakerReduceHelper, {});

  return getUnassignedVariablesAndUsedMacrosHelper(expressions, newUsedMacros, newUnusedMacros);
};


/**
 * Given one or more expressions, determine which macros are needed, and pull in only those.
 *
 * @param {tokenList[]} expressions - The expressions that are being evaluated.
 * @param {macrosObject} macros - Macros internal to the expression
 * @param {collectionMacrosMap} [macrosFromCollection={}]
 *
 * @returns {Object}
 * @property {string[]} variables - The unassigned variables
 * @property {macrosObject} usedMacros
 */
const getUnassignedVariablesAndUsedMacros = (expressions, macros, macrosFromCollection = {}) => {
  const unusedMacros = {
    ...macrosFromCollection,
    ...Object.entries(macros).map(
      ([macroName, formula]) => [macroName, { formula, helpers: {} }])
      .reduce(objectMakerReduceHelper, {}),
  };
  return getUnassignedVariablesAndUsedMacrosHelper(expressions, {}, unusedMacros);
};

export default getUnassignedVariablesAndUsedMacros;
