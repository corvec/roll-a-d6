import tokenize, {
  getTargetCollection,
  isRoll, stripPrefix, stripSuffix,
  variableTargetsCollection,
} from '../formulaTokenizer';
import parseTokens from './parseTokens';
import getUnassignedVariablesAndUsedMacros from './getUnassignedVariablesAndUsedMacros';
import { objectMakerReduceHelper } from '../helpers';
import evaluateFormula from '../evaluateFormula';


/**
 * @typedef RollType
 * @type {('roll'|'value'|'roll-with-unknowns'|'value-with-unknowns')}
 */

/**
 * @param {} expressions
 * @param macros
 * @param unknowns
 * @returns {RollType}
 */
const getRollType = (expressions, macros, unknowns) => {
  const hasDiceRoll = expression => expression.some(isRoll);
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
 * @param {collectionMacrosMap} macrosFromCollection
 * @returns {Object}
 * @property {macrosObject} internalMacros - list of macros we are using that are part of the formula
 * @property {macrosObject} externalMacros - list of macros we are using sourced from Collections
 * @property {string[]} unknownVariables - list of referenced variables that are not set
 * @property {string[]} noPromptVariables - list of unknown variables we are not supposed to prompt for
 * @property {Object<string, Object<string, string[]>>} targetedCollections - targeted variables grouped by collection
 * @property {}
 * @property {string} type - Type of the Roll - 'value', 'roll', or value/roll with unknowns
 * }}
 */
const getRollMetadata = (formula, macrosFromCollection) => {
  try {
    const tokens = tokenize(formula);
    const {expressions, macros} = parseTokens(tokens);
    const {variables: unknownVariables, usedMacros} = getUnassignedVariablesAndUsedMacros(
      expressions, macros, macrosFromCollection
    );

    const noPromptVariables = unknownVariables.filter(variable =>
      [...Object.values(usedMacros), ...expressions].some(clause => clause.some(
        token => token === `^${variable}`
      )));
    const internalMacros = Object.entries(usedMacros).filter(
      ([macroName]) => macros.hasOwnProperty(macroName))
      .reduce(objectMakerReduceHelper, {});
    const externalMacros = Object.entries(usedMacros).filter(
      ([macroName]) => !macros.hasOwnProperty(macroName))
      .reduce(objectMakerReduceHelper, {});

    const targetedCollections = unknownVariables.reduce((accum, variable) => {
      if (!variableTargetsCollection(variable)) {
        return accum;
      }
      const baseVariable = stripPrefix(stripSuffix(variable));
      const collection = getTargetCollection(variable);
      return {
        ...accum,
        [collection]: [
          ...(accum.collection || []),
          baseVariable
        ],
      };
    }, {});

    const type = getRollType(expressions, usedMacros, unknownVariables);
    const result = {
      internalMacros,
      externalMacros,
      unknownVariables,
      noPromptVariables,
      targetedCollections,
      type
    };
    if (type === 'value') {
      try {
        result.value = evaluateFormula({expressions, macros: usedMacros}).result;
      } catch (err) {
        result.value = ['Error'];
      }
    }
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

export default getRollMetadata;
