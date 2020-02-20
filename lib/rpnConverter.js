import { peek } from './helpers';
import {isOperator, operatorOrder} from './formulaTokenizer';

/**
 * @param {string} op1
 * @param {string} op2
 * @returns {boolean} True if op1 is of higher precedence than operator 2,
 * e.g., a op1 b op2 c should be grouped as (a op1 b) op2 c
 */
const op1Precedes = (op1, op2) => {
  const finder = op => ary => ary.includes(op);
  const op1Value = operatorOrder.findIndex(finder(op1));
  const op2Value = operatorOrder.findIndex(finder(op2));
  return (op1Value <= op2Value);
};

const placeholderMap = {
  '->': '=>',
};
const requiresPlaceholder = token => placeholderMap.hasOwnProperty(token);
const getPlaceholder = token => placeholderMap[token];

/**
 * Convert tokens from infix notation to reverse polish notation, following order of operations and
 * respecting parentheses.
 *
 * @param {tokenList} tokens
 * @return {tokenList}
 */
const convertToRPN = (tokens) => {
  const logRPN = false;
  const log = (...args) => { if (logRPN) console.log(...args); }
  log(`convertToRPN(${tokens.join(' ')})`);
  const result = [];
  const operatorStack = [];
  const logState = () => log(`result: '${result.join(' ')}' | ops: [${operatorStack.join(',')}]`);
  tokens.forEach(token => {
    logState();
    if (requiresPlaceholder(token)) {
      if (operatorStack.length > 0) {
        result.push(operatorStack.pop());
      }
      operatorStack.push(getPlaceholder(token));
    }
    if (isOperator(token)) {
      while (operatorStack.length > 0 && op1Precedes(token, peek(operatorStack))) {
        log(`result<<ops.pop (${peek(operatorStack)})`);
        result.push(operatorStack.pop());
      }
      log(`ops<<${token}`);
      operatorStack.push(token);
    } else if (token === '(') {
      log(`ops<<${token}`);
      operatorStack.push(token);
    } else if (token === ')') {
      while (operatorStack.length > 0 && peek(operatorStack) !== '(') {
        log(`result<<ops.pop (${peek(operatorStack)})`);
        result.push(operatorStack.pop());
      }
      log(`ops.pop (${peek(operatorStack)})`);
      operatorStack.pop();
    } else {
      log(`result<<${token}`);
      result.push(token);
    }
  });
  log('EOF');
  while (operatorStack.length > 0) {
    log(`result<<ops.pop (${peek(operatorStack)})`);
    result.push(operatorStack.pop());
  }
  logState();
  return result;
};

export default convertToRPN;
