import { clauseHasMislocatedAssignmentOperator } from '../validateFormula';
import convertToRPN from '../rpnConverter';
import { splitTokenList } from '../formulaTokenizer';
import getUnassignedVariablesAndUsedMacros from './getUnassignedVariablesAndUsedMacros';

/**
 * Get the assignments from a set of tokenized, but not RPNed, clauses.
 * In the response, the assignments will reference the clauses by index.
 *
 * @param {tokenList} clauses
 *
 * @returns {Object}
 * @property {Object.<string, number>} assignments - references to the clauses that
 * @property {tokenList[]} strippedClauses - clauses without the assignments
 */
const parseAssignments = clauses => clauses.reduce((accum, clause, index) => {
  if (clause.length >= 3 && clause[1] === '=') {
    return {
      assignments: {
        ...accum.assignments,
        [clause[0]]: index,
      },
      strippedClauses: [...accum.strippedClauses, clause.slice(2)],
    };
  } else {
    return {
      ...accum,
      strippedClauses: [...accum.strippedClauses, clause],
    };
  }
}, { assignments: {}, strippedClauses: [] });




/**
 * Parse tokens in preparation for evaluation or analysis
 *
 * @param {tokenList} tokens
 *
 * @returns {Object}
 * @property {tokenList[]} expressions - Top level expressions
 * @property {macrosObject} macros - Internal macros
 * @property {string[]} unassignedVariables - Variables that are referenced but not assigned
 * @property {string[]} noPromptVariables - Unassigned variables that should not be prompted for
 *
 */
const parseTokens = (tokens) => {
  const clauses = splitTokenList(tokens);
  if (clauses.some(clauseHasMislocatedAssignmentOperator)) {
    const offendingClauses = clauses.filter(clauseHasMislocatedAssignmentOperator)
    throw new Error(`Assignment is only supported at the very beginning of a clause: ${
      offendingClauses.map(c => c.join(' ')).join(',')
    }`);
  }
  const { assignments, strippedClauses } = parseAssignments(clauses);

  const rpn = strippedClauses.map(clauseTokens => convertToRPN(clauseTokens));
  const macros = Object.entries(assignments).reduce(
    (accum, [assignment, index]) => ({
      ...accum,
      [assignment]: rpn[index],
    }), {});
  const expressions = rpn.filter((_, index) => !Object.values(assignments).includes(index));
  const unassignedVariables = getUnassignedVariablesAndUsedMacros(expressions, macros).variables;
  const noPromptVariables = unassignedVariables.filter(
    variable => rpn.some(clause => clause.some(
      token => token === `^${variable}`
    )));
  return { expressions, macros, unassignedVariables, noPromptVariables };
};

export default parseTokens;
