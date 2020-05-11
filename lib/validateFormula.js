"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.validateFormula = exports.clauseHasMislocatedAssignmentOperator = exports.validateClause = exports.validateParentheses = void 0;

var _formulaTokenizer = _interopRequireDefault(require("./formulaTokenizer"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * Operations on this file are run on formulas prior to their conversion to RPN
 */
const enableLogging = false;

const log = msg => {
  if (enableLogging) console.log(msg);
};
/**
 * Ensure parentheses are balanced
 * @function validateParentheses
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


const validateParentheses = clause => Array.from(clause).reduce((depth, currentChar) => {
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
 * @param {string} clause
 * @returns {boolean} True if valid
 */


exports.validateParentheses = validateParentheses;

const validateBrackets = clause => {
  const brackets = clause.match(/\[[^[\]]*]/g);
  return brackets === null || brackets.every(bracket => /^\[\d+]$/.test(bracket));
};
/**
 * confirm that operators and values alternate
 * @function validateAlternatingTokenType
 * @param {string[]} tokens
 * @returns {boolean} True if valid
 */


const validateAlternatingTokenType = tokens => tokens.reduce((accum, token, i) => {
  if (!accum) {
    return false;
  }

  if (i === 0) {
    const result = (0, _formulaTokenizer.isValue)(token) || token === '(';

    if (!result) {
      log(`clause did not start with ( or value, but with ${token}`);
    }

    return result;
  }

  if (i === tokens.length - 1 && ((0, _formulaTokenizer.isOperator)(token) || token === '(')) {
    log(`last token in the clause was ${token}`);
    return false;
  }

  const lastToken = tokens[i - 1];

  if (token === '=') {
    const result = i === 1 && (0, _formulaTokenizer.isVariable)(lastToken);

    if (!result) {
      log('= was not the second token or did not follow a variable name');
    }

    return result;
  }

  if ((0, _formulaTokenizer.isOperator)(lastToken) || lastToken === '(' || lastToken === '=') {
    const result = (0, _formulaTokenizer.isValue)(token) || token === '(';

    if (!result) {
      log(`An operator, =, or ( was followed by ${token}`);
    }

    return result;
  }

  if ((0, _formulaTokenizer.isValue)(lastToken) || lastToken === ')') {
    const result = (0, _formulaTokenizer.isOperator)(token) || token === ')';

    if (!result) {
      log(`A value or ) was followed by ${token}`);
    }

    return result;
  }

  return false;
}, true);
/**
 * Confirm that the clause matches the appropriate format and that the other validators pass
 * @function validateClause
 * @param {string} clause
 * @param {number|string} i clause descriptor
 * @returns {string[]} Empty if valid. Array of found issues.
 */


const validateClause = (clause, i) => {
  const result = []; // TODO: source valid strings from formulaTokenizer.js or some other shared place instead

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

  const tokens = (0, _formulaTokenizer.default)(clause);

  if (tokens == null || tokens.length === 0 || tokens.join('') !== clause) {
    log(`${clause} could not be tokenized`);
    result.push(`Clause ${i} could not be tokenized`);
    return result;
  }

  if (!tokens.every(_formulaTokenizer.isValidToken)) {
    log(`${clause} had one or more invalid tokens`);
    const invalidTokens = tokens.filter(token => !(0, _formulaTokenizer.isValidToken)(token));
    result.push(`Clause ${i} had invalid tokens: ${invalidTokens.join(', ')}`);

    if (enableLogging) {
      invalidTokens.forEach(token => console.log(`Invalid token: ${token}`));
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
 * @function clauseHasMislocatedAssignmentOperator
 * @param {string[]} clause List of tokens
 * @returns {boolean} True if valid
 */


exports.validateClause = validateClause;

const clauseHasMislocatedAssignmentOperator = clause => clause.some((token, i) => token === '=' && (clause.length < 3 || i !== 1 || !clause[0].match(/^[A-Za-z]\w*(@[A-Za-z]\w+)?$/)));
/**
 * Perform validation for the entire formula (an unconverted string) one clause at a time
 * @function validateFormula
 * @param {string} formula
 * @returns {string[]} Empty if valid. Array of issues found.
 */


exports.clauseHasMislocatedAssignmentOperator = clauseHasMislocatedAssignmentOperator;

const validateFormula = formula => {
  if (typeof formula !== "string") {
    throw new Error('validateFormula() called with an invalid formula (i.e., of a non-string type)');
  }

  const clauses = formula.split(',');
  const result = clauses.reduce((accum, clause, i) => [...accum, ...validateClause(clause, i + 1)], []);

  if (!enableLogging) {
    return result;
  }

  if (!result) {
    clauses.filter(clause => !validateClause(clause)).forEach(clause => log(`invalid clause: ${clause}`));
  }

  return result;
};

exports.validateFormula = validateFormula;
var _default = validateFormula;
exports.default = _default;
//# sourceMappingURL=validateFormula.js.map