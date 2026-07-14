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

import parseTokens from './parseTokens.js';
import getRollMetadata from './getRollMetadata.js';
import getMacrosFromCollection from './getMacrosFromCollection.js';
import getUnassignedVariablesAndUsedMacros from './getUnassignedVariablesAndUsedMacros.js';

export {
  parseTokens,
  getRollMetadata,
  getMacrosFromCollection,
  getUnassignedVariablesAndUsedMacros,
};
