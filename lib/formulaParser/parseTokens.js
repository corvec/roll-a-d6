"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _validateFormula = require("../validateFormula");

var _rpnConverter = _interopRequireDefault(require("../rpnConverter"));

var _formulaTokenizer = require("../formulaTokenizer");

var _getUnassignedVariablesAndUsedMacros = _interopRequireDefault(require("./getUnassignedVariablesAndUsedMacros"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @typedef ParsedAssignments
 * @type {object}
 * @property {object.<string, number>} assignments - references to the clauses by index
 * @property {string[][]} strippedClauses - clauses without the assignments
 */

/**
 * Get the assignments from a set of tokenized, but not RPNed, clauses.
 * In the response, the assignments will reference the clauses by index.
 * @function parseAssignments
 *
 * @param {string[][]} clauses
 *
 * @returns {ParsedAssignments}
 */
const parseAssignments = clauses => clauses.reduce((accum, clause, index) => {
  if (clause.length >= 3 && clause[1] === '=') {
    return {
      assignments: { ...accum.assignments,
        [clause[0]]: index
      },
      strippedClauses: [...accum.strippedClauses, clause.slice(2)]
    };
  } else {
    return { ...accum,
      strippedClauses: [...accum.strippedClauses, clause]
    };
  }
}, {
  assignments: {},
  strippedClauses: []
});
/**
 * @typedef ParsedTokenList
 * @type {object}
 * @property {RPNTokenList[]} expressions - Top level expressions
 * @property {MacroMap} macros - Internal macros
 * @property {string[]} unassignedVariables - Variables that are referenced but not assigned
 * @property {string[]} noPromptVariables - Unassigned variables that should not be prompted for
 */

/**
 * Parse tokens in preparation for evaluation or analysis
 * @function parseTokens
 *
 * @param {string[]} tokens Token list in infix notation
 *
 * @returns {ParsedTokenList}
 */


const parseTokens = tokens => {
  const clauses = (0, _formulaTokenizer.splitTokenList)(tokens);

  if (clauses.some(_validateFormula.clauseHasMislocatedAssignmentOperator)) {
    const offendingClauses = clauses.filter(_validateFormula.clauseHasMislocatedAssignmentOperator);
    throw new Error(`Assignment is only supported at the very beginning of a clause: ${offendingClauses.map(c => c.join(' ')).join(',')}`);
  }

  const {
    assignments,
    strippedClauses
  } = parseAssignments(clauses);
  const rpn = strippedClauses.map(clauseTokens => (0, _rpnConverter.default)(clauseTokens));
  const macros = Object.entries(assignments).reduce((accum, [assignment, index]) => ({ ...accum,
    [assignment]: rpn[index]
  }), {});
  const expressions = rpn.filter((_, index) => !Object.values(assignments).includes(index));
  const unassignedVariables = (0, _getUnassignedVariablesAndUsedMacros.default)(expressions, macros).variables;
  const noPromptVariables = unassignedVariables.filter(variable => rpn.some(clause => clause.some(token => token === `^${variable}`)));
  return {
    expressions,
    macros,
    unassignedVariables,
    noPromptVariables
  };
};

var _default = parseTokens;
exports.default = _default;
//# sourceMappingURL=parseTokens.js.map