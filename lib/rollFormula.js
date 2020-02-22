import tokenize from './formulaTokenizer';
import validateFormula from './validateFormula';
import * as formulaParser from './formulaParser';
import evaluateFormula from './evaluateFormula';
import {objectMakerReduceHelper} from "./helpers";

/**
 * @typedef resultRange
 * @type {Object}
 * @property {resultEntry} result The result when evaluated in this range
 * @property {string} variable The name of the variable
 * @property {number} minValue The lowest value for which this result is applicable
 * @property {number} maxValue The highest value for which this result is applicable
 */

const buildResultRange =
  ({ expressions, macrosWithCertainty, rolls, uncertainValues, result, maxRange = 40 }) =>
  [...Array(maxRange).keys()].reduce((accum, testValue) => {
      const { result: currentResult } = evaluateFormula({
        expressions,
        macros: macrosWithCertainty(testValue),
        rolls
      });
      if (currentResult.every((value, index) => value === accum.slice(-1)[0].result[index])) {
        return accum;
      }
      return [
        ...accum.slice(0, -1),
        {
          ...accum.slice(-1)[0],
          maxValue: testValue - 1
        },
        {
          minValue: testValue,
          result: currentResult
        }
      ];
    },
    [
      {
        variable: uncertainValues[0],
        minValue: 0,
        result
      }
    ]
  );

/**
 * Validate, parse, and evaluate a formula, potentially pulling in collection data if needed
 * @param {string} formula
 * @param {Object.<string,string>} collectionMacros
 * @returns {{result: *, rolls: Array}|{result: string[], rolls: Array}}
 * @returns {Object}
 * @property {resultEntry[]|resultRange[]} result Either the results from evaluation OR an array
 *                                      of results at multiple input values for a given variable
 * @property {string[]} rolls Log of all rolls made as part of the evaluation
 * @property {macrosObject} macros Macros that were included in the initial expression
 * @property {macrosObject} allMacros All macros - expression, collection, and inline,
 */
const rollFormula = (formula, collectionMacros) => {
  const validity = validateFormula(formula);
  if (validity.length > 0) {
    return {
      result: [`Invalid formula! Issues: ${validity.join(', ')}`],
      rolls: [],
    };
  }
  const tokens = tokenize(formula);

  const { expressions, macros, unassignedVariables } = formulaParser.parseTokens(tokens);

  const macrosFromCollection = unassignedVariables.length > 0
    ? formulaParser.getMacrosFromCollection(collectionMacros)
    : {};

  const { variables, usedMacros } = formulaParser.getUnassignedVariablesAndUsedMacros(
    expressions, macros, macrosFromCollection
  );

  const noPromptVariables = variables.filter(variable =>
    [...Object.values(usedMacros), ...expressions].some(clause => clause.some(
        token => token === `^${variable}`
    )));

  // TODO: Prompt for these inline
  const newMacros = variables
    .filter(variable => !noPromptVariables.includes(variable))
    .reduce((accum, variable) => {
      const value = window.prompt(`Value of ${variable}`, '0');
      return {
        ...accum,
        [variable]: [value],
      };
    }, {});
  const allMacros = {
    ...usedMacros,
    ...newMacros,
    ...noPromptVariables.map(variable => [variable, ['0']]).reduce(objectMakerReduceHelper, {})
  };
  const uncertainValues = Object.entries(allMacros)
    .filter(([, tokens]) => tokens.length === 1 && tokens[0] === '?')
    .map(([macroName]) => macroName);
  if (uncertainValues.length > 1) {
    throw new Error('Multiple uncertain values are not yet supported.');
  }
  if (uncertainValues.length === 0) {
    const {result, rolls} = evaluateFormula({expressions, macros: allMacros});
    return {result, rolls, allMacros, macros};
  }
  const macrosWithCertainty = value => ({
    ...allMacros,
    [uncertainValues[0]]: [`${value}`],
  });
  const { result, rolls } = evaluateFormula({ expressions, macros: macrosWithCertainty(0) });
  const resultRange = buildResultRange({ expressions, macrosWithCertainty, result, rolls, uncertainValues });

  return { result: resultRange, rolls, allMacros, macros };
};

export default rollFormula;
