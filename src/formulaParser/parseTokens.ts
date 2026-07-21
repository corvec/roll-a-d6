import { clauseHasMislocatedAssignmentOperator } from '../validateFormula.js';
import convertToRPN from '../rpnConverter.js';
import { splitTokenList } from '../formulaTokenizer.js';
import getUnassignedVariablesAndUsedMacros from './getUnassignedVariablesAndUsedMacros.js';
import type { MacroMap, RPNTokenList } from '../types.js';

export interface ParsedAssignments {
  /** references to the clauses by index */
  assignments: Record<string, number>;
  /** clauses without the assignments */
  strippedClauses: string[][];
}

/**
 * Get the assignments from a set of tokenized, but not RPNed, clauses.
 * In the response, the assignments will reference the clauses by index.
 */
const parseAssignments = (clauses: string[][]): ParsedAssignments => clauses.reduce(
  (accum: ParsedAssignments, clause, index) => {
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
  },
  { assignments: {}, strippedClauses: [] },
);


export interface ParsedTokenList {
  /** Top level expressions */
  expressions: RPNTokenList[];
  /** Internal macros */
  macros: MacroMap;
  /** Variables that are referenced but not assigned */
  unassignedVariables: string[];
  /** Unassigned variables that should not be prompted for */
  noPromptVariables: string[];
}

/**
 * Parse tokens in preparation for evaluation or analysis
 * @param tokens Token list in infix notation
 */
const parseTokens = (tokens: string[]): ParsedTokenList => {
  const clauses = splitTokenList(tokens);
  if (clauses.some(clauseHasMislocatedAssignmentOperator)) {
    const offendingClauses = clauses.filter(clauseHasMislocatedAssignmentOperator);
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
    }), {} as MacroMap);
  const expressions = rpn.filter((_, index) => !Object.values(assignments).includes(index));
  const unassignedVariables = getUnassignedVariablesAndUsedMacros(expressions, macros).variables;
  const noPromptVariables = unassignedVariables.filter(
    variable => rpn.some(clause => clause.some(
      token => token === `^${variable}`,
    )));
  return { expressions, macros, unassignedVariables, noPromptVariables };
};

export default parseTokens;
