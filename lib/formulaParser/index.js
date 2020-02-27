/**
 * Grammar:
 * * formula
 * * formula: clause | clause,clause...
 * * clause: group | boolean | assignment
 * * assignment: var = group
 * * op: + | - | * | /
 * * group: value | group op group | (group) | conditional | var | indexed var (x[0]) | param (v[0]) | boolean
 * * comparator: < | > | <= | >= | == | <>
 * * boolean: group comparator group
 * * conditional: boolean -> group ; group | boolean -> group
 *
 * * value = number | roll (3d6)
 *
 * NOTE: The grammar isn't actually strictly enforced.
 * Instead we just strip assignments, convert it to RPN, and then distinguish between values and operators
 */


/**
 * A list of tokens in Reverse Polish Notation, e.g., ['1d6','5','+']
 * @typedef RPNTokenList
 * @type {string[]}
 */

/**
 * A map from var names to their tokenized expressions.
 * @typedef MacroMap
 * @type {Object.<string, RPNTokenList>}
 */

/**
 * A single Collection formula, converted from the user-entered form into a tokenized, usable object.
 * @typedef CollectionRoll
 * @type {Object}
 * @property {RPNTokenList} formula The main expression associated with this macro
 * @property {MacroMap} helpers The helper macros for the main expression
 */

/**
 * Map from names to rolls that have been converted to RPN and are thus available for evaluation
 * @typedef Collection
 * @type {Object.<String, CollectionRoll>}
 */

import parseTokens from './parseTokens';
import getRollMetadata from './getRollMetadata';
import getMacrosFromCollection from './getMacrosFromCollection';
import getUnassignedVariablesAndUsedMacros from './getUnassignedVariablesAndUsedMacros';

export {
  parseTokens,
  getRollMetadata,
  getMacrosFromCollection,
  getUnassignedVariablesAndUsedMacros
};
