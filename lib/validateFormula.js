/*
 * Operations on this file are run on formulas prior to their conversion to RPN
 */


import tokenize, { isOperator, isValidToken, isValue, isVariable } from './formulaTokenizer';

const enableLogging = false;
const log = msg => { if (enableLogging) console.log(msg) };

/**
 * @example
 * // returns false
 * validateParentheses('())(')
 * // return false
 * validateParentheses('(()')
 * // return true
 * validateParentheses('()')
 *
 * @param {string} clause
 * @returns {boolean} True if valid
 */
export const validateParentheses = (clause) => {
  let depth = 0;
  for (let loc = 0; loc < clause.length; loc++) {
    const currentChar = clause.substr(loc, 1);
    switch (currentChar) {
      case '(':
        depth += 1;
        break;
      case ')':
        depth -= 1;
        if (depth < 0) {
          return false;
        }
        break;
      default:
        break;
    }
  }
  return depth === 0;
};

/**
 * confirm that brackets are only used to contain numbers, e.g., [5]
 *
 * @param {string} clause
 * @returns {boolean} True if valid
 */
const validateBrackets = (clause) => {
  const brackets = clause.match(/\[[^[\]]*]/g);
  return brackets === null || brackets.every(bracket => /^\[\d+]$/.test(bracket));
};

/**
 * @function
 * confirm that operators and values alternate
 * @param {string[]} tokens
 * @returns {boolean} True if valid
 */
const validateAlternatingTokenType = tokens => tokens.reduce(
  (accum, token, i) => {
    if (!accum) {
      return false;
    }
    if (i === 0) {
      const result = isValue(token) || token === '(';
      if (!result) {
        log(`clause did not start with ( or value, but with ${token}`)
      }
      return result;
    }
    if (i === tokens.length - 1 && (isOperator(token) || token === '(')) {
      log(`last token in the clause was ${token}`);
      return false;
    }
    const lastToken = tokens[i-1];
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
    true
);

/**
 * Confirm that the clause matches the appropriate format and that the other validators pass
 * @param {string} clause
 * @param {number|string} i clause descriptor
 * @returns {string[]} Empty if valid. Array of found issues.
 */
export const validateClause = (clause, i) => {
  const result = [];

  // TODO: source valid strings from formulaTokenizer.js or some other shared place instead
  if (clause.length === 0 || !clause.match(/^([\^$]?\w(@\w+)?|[#+\-*/<>=;()[\]{}|&?.])+$/)) {
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
        token => console.log(`Invalid token: ${token}`)
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
 * @param {string[]} clause List of tokens
 * @return {boolean} True if valid
 */
export const clauseHasMislocatedAssignmentOperator = clause => clause.some(
    (token, i) => token === '='
        && (clause.length < 3
            || i !== 1
            || !clause[0].match(/^[A-Za-z]\w*(@[A-Za-z]\w+)?$/))
);

/**
 * Perform validation for the entire formula (an unconverted string) one clause at a time
 * @param {string} formula
 * @return {string[]} Empty if valid. Array of issues found.
 */
export const validateFormula = (formula) => {
  if (typeof formula !== "string") {
      throw new Error('validateFormula() called with an invalid formula (i.e., of a non-string type)')
  }
  const clauses = formula.split(',');
  const result = clauses.reduce(
    (accum, clause, i) => [
      ...accum,
      ...validateClause(clause, i + 1),
    ],
    []
  );
  if (!enableLogging) {
    return result;
  }
  if (!result) {
    clauses.filter(clause => !validateClause(clause))
      .forEach(clause => log(`invalid clause: ${clause}`));
  }
  return result;
};


export default validateFormula;
