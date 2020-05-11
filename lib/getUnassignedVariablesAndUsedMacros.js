"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _formulaTokenizer = require("../formulaTokenizer");

var _helpers = require("../helpers");

/**
 * Returns a reducer helper that will, given a list of already known variables, return a list of
 * any variables not already listed.
 *
 * @param {object<string, string>} variables The variables that are already known
 * @returns {function(string[], RPNTokenList): string[]}
 */
const getNewVariablesReduceHelper = (variables = {}) => (accum, expressions) => [...new Set([...accum, ...expressions.filter(token => (0, _formulaTokenizer.isVariable)(token)).map(_formulaTokenizer.stripPrefix).filter(variable => !variables.hasOwnProperty(variable)), ...expressions.filter(token => (0, _formulaTokenizer.isVariableInstance)(token)).map(_formulaTokenizer.stripPrefix).map(_formulaTokenizer.stripSuffix).filter(variable => !variables.hasOwnProperty(variable))])];

const getUnassignedVariablesAndUsedMacrosHelper = (expressions, usedMacros, unusedMacros) => {
  const rpn = [...expressions, ...Object.values(usedMacros)];
  const variables = rpn.reduce(getNewVariablesReduceHelper(usedMacros), []);

  if (variables.length === 0) {
    return {
      variables,
      usedMacros
    };
  }

  const newUsedMacros = variables.reduce((accum, variable) => unusedMacros.hasOwnProperty(variable) ? { ...unusedMacros[variable].helpers,
    ...accum,
    [variable]: unusedMacros[variable].formula
  } : accum, usedMacros);

  if (Object.keys(newUsedMacros).length === Object.keys(usedMacros).length) {
    return {
      variables,
      usedMacros
    };
  }

  const newUnusedMacros = Object.entries(unusedMacros).filter(([key]) => !newUsedMacros.hasOwnProperty(key)).reduce(_helpers.objectMakerReduceHelper, {});
  return getUnassignedVariablesAndUsedMacrosHelper(expressions, newUsedMacros, newUnusedMacros);
};
/**
 * @typedef UnassignedVariablesAndUsedMacros
 * @type {object}
 * @property {string[]} variables - The unassigned variables
 * @property {MacroMap} usedMacros - Macros that have been referenced and that thus need to be pulled in
 */

/**
 * Given one or more expressions, determine which macros are needed, and pull in only those.
 *
 * @param {RPNTokenList[]} expressions - The expressions that are being evaluated.
 * @param {MacroMap} macros - Macros internal to the expression
 * @param {Collection} [macrosFromCollection={}]
 *
 * @returns {UnassignedVariablesAndUsedMacros}
 */


const getUnassignedVariablesAndUsedMacros = (expressions, macros, macrosFromCollection = {}) => {
  const unusedMacros = { ...macrosFromCollection,
    ...Object.entries(macros).map(([macroName, formula]) => [macroName, {
      formula,
      helpers: {}
    }]).reduce(_helpers.objectMakerReduceHelper, {})
  };
  return getUnassignedVariablesAndUsedMacrosHelper(expressions, {}, unusedMacros);
};

var _default = getUnassignedVariablesAndUsedMacros;
exports.default = _default;
//# sourceMappingURL=getUnassignedVariablesAndUsedMacros.js.map