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
 * @typedef tokenList
 * @type {string[]}
 */

/**
 * @typedef macrosObject
 * @type {Object.<string, tokenList>}
 */

/**
 * @typedef collectionMacrosObject
 * @type {Object}
 * @property {tokenList} formula The main expression associated with this macro
 * @property {macrosObject} helpers The helper macros for the main expression
 */

/**
 * @typedef collectionMacrosMap
 * @type {Object.<String, collectionMacrosObject>}
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
