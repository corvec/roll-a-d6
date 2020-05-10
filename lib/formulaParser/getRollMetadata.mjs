import tokenize, {
  getTargetCollection,
  isRoll, stripPrefix, stripSuffix,
  variableTargetsCollection,
  isSideEffectVariable,
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
 * @param {string[]} expressions
 * @param {MacroMap} macros
 * @param {string[]} unknowns
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

    const targetedCollections = unknownVariables
      .filter(variableTargetsCollection)
      .map(variable => ({
        baseVariable: stripPrefix(stripSuffix(variable)),
        collection: getTargetCollection(variable)
      }))
      .reduce((accum, { baseVariable, collection }) => ({
        ...accum,
        [collection]: [
          ...(accum[collection] || []),
          baseVariable,
        ],
      }), {});

    const sideEffects = tokens.filter(isSideEffectVariable).map(stripSuffix).map(stripPrefix);

    const type = getRollType(expressions, usedMacros, unknownVariables);
    const getValue = () => {
      try {
        return { value: evaluateFormula({expressions, macros: usedMacros}).result };
      } catch (err) {
        return { value: ['Error'] };
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
      ...(type === 'value' ? getValue() : {}),
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

export default getRollMetadata;
