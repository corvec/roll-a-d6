import tokenize, {
  getTargetCollection,
  isRoll, stripPrefix, stripSuffix,
  variableTargetsCollection,
  isSideEffectVariable,
} from '../formulaTokenizer.js';
import parseTokens from './parseTokens.js';
import getUnassignedVariablesAndUsedMacros from './getUnassignedVariablesAndUsedMacros.js';
import { objectMakerReduceHelper } from '../helpers.js';
import evaluateFormula from '../evaluateFormula.js';
import type { MacroCollection, MacroMap, ResultEntry, RPNTokenList } from '../types.js';


export type RollType = 'roll' | 'value' | 'roll-with-unknowns' | 'value-with-unknowns' | 'error';

const getRollType = (
  expressions: RPNTokenList[],
  macros: MacroMap,
  unknowns: string[],
): RollType => {
  const hasDiceRoll = (expression: RPNTokenList) => expression.some(isRoll);
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

export interface RollMetadata {
  /** list of macros we are using that are part of the formula */
  internalMacros?: MacroMap;
  /** list of macros we are using sourced from Collections */
  externalMacros?: MacroMap;
  /** list of referenced variables that are not set */
  unknownVariables: string[];
  /** list of unknown variables we are not supposed to prompt for */
  noPromptVariables?: string[];
  /** targeted variables grouped by collection */
  targetedCollections: Record<string, string[]>;
  /** list of variables that could have side effects applied */
  sideEffects?: string[];
  /** Type of the Roll - 'value', 'roll', value/roll with unknowns, or 'error' */
  type: RollType;
  /** The evaluated result, only present for type 'value' (or 'error') */
  value?: ResultEntry[];
}

/**
 * Generate a list of details for a roll:
 * * external macros
 * * unknown variables
 * * internal macros
 * * unknown variables that we should not prompt for
 * * variables that are intended to come from different collections
 * * variables that have side effects
 */
const getRollMetadata = (formula: string, macrosFromCollection?: MacroCollection): RollMetadata => {
  try {
    const tokens = tokenize(formula) as string[];
    const { expressions, macros } = parseTokens(tokens);
    const { variables: unknownVariables, usedMacros } = getUnassignedVariablesAndUsedMacros(
      expressions, macros, macrosFromCollection,
    );

    const noPromptVariables = unknownVariables.filter(variable =>
      [...Object.values(usedMacros), ...expressions].some(clause => clause.some(
        token => token === `^${variable}`,
      )));
    const internalMacros = Object.entries(usedMacros).filter(
      ([macroName]) => macros.hasOwnProperty(macroName))
      .reduce(objectMakerReduceHelper<RPNTokenList>, {});
    const externalMacros = Object.entries(usedMacros).filter(
      ([macroName]) => !macros.hasOwnProperty(macroName))
      .reduce(objectMakerReduceHelper<RPNTokenList>, {});

    const targetedCollections = unknownVariables
      .filter(variableTargetsCollection)
      .map(variable => ({
        baseVariable: stripPrefix(stripSuffix(variable)),
        collection: getTargetCollection(variable) as string,
      }))
      .reduce((accum: Record<string, string[]>, { baseVariable, collection }) => ({
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
        return { value: evaluateFormula({ expressions, macros: usedMacros }).result };
      } catch {
        return { value: ['Error'] };
      }
    };
    const result: RollMetadata = {
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
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Caught error in getRollMetadata for ${formula}: ${message}`);
    console.warn(err instanceof Error ? err.stack : undefined);
    return {
      targetedCollections: {},
      unknownVariables: [],
      type: 'error',
      value: [`Error: ${message}`],
    };
  }
};

export default getRollMetadata;
