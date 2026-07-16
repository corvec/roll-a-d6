/*
 * Operations on this file are run on formulas prior to their conversion to RPN
 */

import tokenize, { isOperator, isValidToken, isValue, isVariable } from './formulaTokenizer.js';

const enableLogging: boolean = false;
const log = (msg: string) => { if (enableLogging) console.log(msg); };

/**
 * Ensure parentheses are balanced
 * @example
 * // returns false
 * validateParentheses('())(')
 * // return false
 * validateParentheses('(()')
 * // return true
 * validateParentheses('()')
 *
 * @returns True if valid
 */
export const validateParentheses = (clause: string): boolean =>
  Array.from(clause).reduce((depth: number, currentChar) => {
    switch (currentChar) {
      case '(':
        return depth + 1;
      case ')':
        if (depth <= 0) {
          return NaN;
        }
        return depth - 1;
      default:
        return depth;
    }
  }, 0) === 0;

/**
 * confirm that brackets are only used to contain numbers, e.g., [5]
 *
 * @returns True if valid
 */
const validateBrackets = (clause: string): boolean => {
  const brackets = clause.match(/\[[^[\]]*]/g);
  return brackets === null || brackets.every(bracket => /^\[\d+]$/.test(bracket));
};

/**
 * confirm that operators and values alternate
 * @returns True if valid
 */
const validateAlternatingTokenType = (tokens: string[]): boolean => tokens.reduce(
  (accum: boolean, token, i) => {
    if (!accum) {
      return false;
    }
    if (i === 0) {
      const result = isValue(token) || token === '(';
      if (!result) {
        log(`clause did not start with ( or value, but with ${token}`);
      }
      return result;
    }
    if (i === tokens.length - 1 && (isOperator(token) || token === '(')) {
      log(`last token in the clause was ${token}`);
      return false;
    }
    const lastToken = tokens[i - 1];
    if (token === '=') {
      const result = (i === 1 && isVariable(lastToken));
      if (!result) {
        log('= was not the second token or did not follow a variable name');
      }
      return result;
    }
    if (isOperator(lastToken) || lastToken === '(' || lastToken === '=') {
      const result = isValue(token) || token === '(';
      if (!result) {
        log(`An operator, =, or ( was followed by ${token}`);
      }
      return result;
    }
    if (isValue(lastToken) || lastToken === ')') {
      const result = isOperator(token) || token === ')';
      if (!result) {
        log(`A value or ) was followed by ${token}`);
      }
      return result;
    }
    return false;
  },
  true,
);

/**
 * Confirm that the clause matches the appropriate format and that the other validators pass
 * @param clause
 * @param i clause descriptor
 * @returns Empty if valid. Array of found issues.
 */
export const validateClause = (clause: string, i?: number | string): string[] => {
  const result: string[] = [];

  // TODO: source valid strings from formulaTokenizer.ts or some other shared place instead
  if (clause.length === 0 || !clause.match(/^([\^$]?\w(@\w+)?|[#+\-*/<>=:;()[\]{}|&?.])+$/)) {
    log(`${clause} did not match validation regex`);
    result.push(`Invalid characters in clause ${i}`);
  }
  if (!validateBrackets(clause)) {
    log(`${clause} did not have valid brackets`);
    result.push(`Invalid brackets in clause ${i}`);
  }
  if (!validateParentheses(clause)) {
    log(`${clause} did not have valid parentheses`);
    result.push(`Invalid parentheses in clause ${i}`);
  }
  const tokens = tokenize(clause);
  if (tokens == null || tokens.length === 0 || tokens.join('') !== clause) {
    log(`${clause} could not be tokenized`);
    result.push(`Clause ${i} could not be tokenized`);
    return result;
  }
  if (!tokens.every(isValidToken)) {
    log(`${clause} had one or more invalid tokens`);
    const invalidTokens = tokens.filter(token => !isValidToken(token));
    result.push(`Clause ${i} had invalid tokens: ${invalidTokens.join(', ')}`);

    if (enableLogging) {
      invalidTokens.forEach(
        token => console.log(`Invalid token: ${token}`),
      );
    }
    return result;
  }
  if (!validateAlternatingTokenType(tokens)) {
    log(`${clause} did not have proper token order`);
    result.push(`${clause} had improper token order`);
  }
  return result;
};

/**
 * Ensure that assignment only happens at the beginning of a clause
 * @param clause List of tokens
 * @returns True if the clause has a mislocated assignment operator
 */
export const clauseHasMislocatedAssignmentOperator = (clause: string[]): boolean => clause.some(
  (token, i) => token === '='
    && (clause.length < 3
      || i !== 1
      || !clause[0].match(/^[A-Za-z]\w*(@[A-Za-z]\w+)?$/)),
);

/**
 * Perform validation for the entire formula (an unconverted string) one clause at a time
 * @returns Empty if valid. Array of issues found.
 */
export const validateFormula = (formula: string): string[] => {
  if (typeof formula !== 'string') {
    throw new Error('validateFormula() called with an invalid formula (i.e., of a non-string type)');
  }
  const clauses = formula.split(',');
  const result = clauses.flatMap((clause, i) => validateClause(clause, i + 1));
  if (!enableLogging) {
    return result;
  }
  if (!result) {
    clauses.filter(clause => validateClause(clause).length > 0)
      .forEach(clause => log(`invalid clause: ${clause}`));
  }
  return result;
};


export default validateFormula;
