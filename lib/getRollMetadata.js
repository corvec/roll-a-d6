"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _formulaTokenizer = _interopRequireDefault(require("../formulaTokenizer"));

var _parseTokens = _interopRequireDefault(require("./parseTokens"));

var _getUnassignedVariablesAndUsedMacros = _interopRequireDefault(require("./getUnassignedVariablesAndUsedMacros"));

var _helpers = require("../helpers");

var _evaluateFormula = _interopRequireDefault(require("../evaluateFormula"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @typedef RollType
 * @type {('roll'|'value'|'roll-with-unknowns'|'value-with-unknowns')}
 */

/**
 * @param {string[]} expressions
 * @param {MacroMap} macros
 * @param {string[]} unknowns
 * @returns {RollType}
 */
const getRollType = (expressions, macros, unknowns) => {
  const hasDiceRoll = expression => expression.some(_formulaTokenizer.isRoll);

  if (unknowns.length === 0) {
    if (expressions.some(hasDiceRoll) || Object.values(macros).some(hasDiceRoll)) {
      return 'roll';
    } else {
      return 'value';
    }
  } else {
    if (expressions.some(hasDiceRoll) || Object.values(macros).some(hasDiceRoll)) {
      return 'roll-with-unknowns';
    } else {
      return 'value-with-unknowns';
    }
  }
};
/**
 * @typedef RollMetadata
 * @type {object}
 * @property {MacroMap} internalMacros - list of macros we are using that are part of the formula
 * @property {MacroMap} externalMacros - list of macros we are using sourced from Collections
 * @property {string[]} unknownVariables - list of referenced variables that are not set
 * @property {string[]} noPromptVariables - list of unknown variables we are not supposed to prompt for
 * @property {object.<string, object.<string, string[]>>} targetedCollections - targeted variables grouped by collection
 * @property {Array.<string>} sideEffects - list of variables that could have side effects applied
 * @property {string} type - Type of the Roll - 'value', 'roll', or value/roll with unknowns
 *
 */

/**
 * Generate a list of details for a roll:
 * * external macros
 * * unknown variables
 * * internal macros
 * * unknown variables that we should not prompt for
 * * variables that are intended to come from different collections
 * * variables that have side effects
 *
 *
 * @param {string} formula
 * @param {Collection} macrosFromCollection
 * @returns {RollMetadata}
 */


const getRollMetadata = (formula, macrosFromCollection) => {
  try {
    const tokens = (0, _formulaTokenizer.default)(formula);
    const {
      expressions,
      macros
    } = (0, _parseTokens.default)(tokens);
    const {
      variables: unknownVariables,
      usedMacros
    } = (0, _getUnassignedVariablesAndUsedMacros.default)(expressions, macros, macrosFromCollection);
    const noPromptVariables = unknownVariables.filter(variable => [...Object.values(usedMacros), ...expressions].some(clause => clause.some(token => token === `^${variable}`)));
    const internalMacros = Object.entries(usedMacros).filter(([macroName]) => macros.hasOwnProperty(macroName)).reduce(_helpers.objectMakerReduceHelper, {});
    const externalMacros = Object.entries(usedMacros).filter(([macroName]) => !macros.hasOwnProperty(macroName)).reduce(_helpers.objectMakerReduceHelper, {});
    const targetedCollections = unknownVariables.filter(_formulaTokenizer.variableTargetsCollection).map(variable => ({
      baseVariable: (0, _formulaTokenizer.stripPrefix)((0, _formulaTokenizer.stripSuffix)(variable)),
      collection: (0, _formulaTokenizer.getTargetCollection)(variable)
    })).reduce((accum, {
      baseVariable,
      collection
    }) => ({ ...accum,
      [collection]: [...(accum[collection] || []), baseVariable]
    }), {});
    const sideEffects = tokens.filter(_formulaTokenizer.isSideEffectVariable).map(_formulaTokenizer.stripSuffix).map(_formulaTokenizer.stripPrefix);
    const type = getRollType(expressions, usedMacros, unknownVariables);

    const getValue = () => {
      try {
        return {
          value: (0, _evaluateFormula.default)({
            expressions,
            macros: usedMacros
          }).result
        };
      } catch (err) {
        return {
          value: ['Error']
        };
      }
    };

    const result = {
      internalMacros,
      externalMacros,
      unknownVariables,
      noPromptVariables,
      targetedCollections,
      sideEffects,
      type,
      ...(type === 'value' ? getValue() : {})
    };
    return result;
  } catch (err) {
    console.warn(`Caught error in getRollMetadata for ${formula}: ${err.message}`);
    console.warn(err.stack);
    return {
      targetedCollections: {},
      unknownVariables: [],
      type: 'error',
      value: [`Error: ${err.message}`]
    };
  }
};

var _default = getRollMetadata;
exports.default = _default;
//# sourceMappingURL=getRollMetadata.js.map