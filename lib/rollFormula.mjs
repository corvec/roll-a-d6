import tokenize from './formulaTokenizer.mjs';
import validateFormula from './validateFormula.mjs';
import * as formulaParser from './formulaParser/index.mjs';
import evaluateFormula from './evaluateFormula.mjs';
import { objectMakerReduceHelper } from './helpers.mjs';
import * as ErrorTypes from './errorTypes';

/**
 * @typedef ResultRange
 * @type {object}
 * @property {ResultEntry} result The result when evaluated in this range
 * @property {string} variable The name of the variable
 * @property {number} minValue The lowest value for which this result is applicable
 * @property {number} maxValue The highest value for which this result is applicable
 */

/**
 * Determine the result given different values of a single input, and build the ResultRange to model
 * this.
 * @function buildResultRange
 * @param {object} p
 * @param {RPNTokenList[]} p.expressions
 * @param {Function} p.macrosWithCertainty
 * @param {string[]} p.rolls
 * @param {string[]} p.uncertainValues
 * @param {ResultEntry[]} p.result
 * @param {number} p.maxRange
 * @param {SideEffects} p.initialSideEffects
 * @returns {ResultRange[]}
 */
export const buildResultRange =
  ({ expressions, macrosWithCertainty, rolls, uncertainValues, result, maxRange = 40, initialSideEffects }) =>
  [...Array(maxRange).keys()].reduce((accum, testValue) => {
      const { sideEffects, result: currentResult } = evaluateFormula({
        expressions,
        macros: macrosWithCertainty(testValue),
        rolls // don't need to pass a new one in because we mutate the old one
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
        }
      ];
    },
    [
      {
        variable: uncertainValues[0],
        minValue: 0,
        result,
        sideEffects: initialSideEffects,
      }
    ]
  );

/**
 * @typedef RolledFormula
 * @type {object}
 * @property {ResultEntry[]|ResultRange[]} result Either the results from evaluation OR an array
 *                                      of results at multiple input values for a given variable
 * @property {RollLog} rolls Log of all rolls made as part of the evaluation
 * @property {SideEffects} sideEffects Side effects applied from this roll
 * @property {MacroMap} macros Macros that were included in the initial expression
 * @property {MacroMap} allMacros All macros - expression, collection, and inline
 */

/**
 * Validate, parse, and evaluate a formula, potentially pulling in collection data if needed
 * @function rollFormula
 * @param {string} formula
 * @param {object.<string,string>} collectionFormulasMap
 * @returns {RolledFormula}
 */
export const rollFormula = (formula, collectionFormulasMap) => {
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
    ? formulaParser.getMacrosFromCollection(collectionFormulasMap)
    : {};

  const { variables, usedMacros } = formulaParser.getUnassignedVariablesAndUsedMacros(
    expressions, macros, macrosFromCollection
  );

  const noPromptVariables = variables.filter(variable =>
    [...Object.values(usedMacros), ...expressions].some(clause => clause.some(
        token => token === `^${variable}`
    )));

  const missingVariables = variables.filter(variable => !noPromptVariables.includes(variable));
  if (missingVariables.length > 0) {
    throw new ErrorTypes.UnknownVariablesError(missingVariables);
  }

  // TODO: Determine newly required unassigned macros in the UI
  //       Should only require calling getRollMetadata
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
    const {result, rolls, sideEffects} = evaluateFormula({expressions, macros: allMacros});
    return {result, rolls, sideEffects, allMacros, macros};
  }
  const macrosWithCertainty = value => ({
    ...allMacros,
    [uncertainValues[0]]: [`${value}`],
  });
  const { result, rolls, sideEffects: initialSideEffects } = evaluateFormula({ expressions, macros: macrosWithCertainty(0) });
  const resultRange = buildResultRange({ expressions, macrosWithCertainty, result, rolls, uncertainValues, initialSideEffects });

  return { result: resultRange, rolls, allMacros, macros };
};

export default rollFormula;
