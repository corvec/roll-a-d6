import { peek } from './helpers.js';
import { isOperator, operatorOrder } from './formulaTokenizer.js';
import type { RPNTokenList } from './types.js';

/**
 * @returns True if op1 is of higher precedence than operator 2,
 * e.g., a op1 b op2 c should be grouped as (a op1 b) op2 c
 */
const op1Precedes = (op1: string, op2: string): boolean => {
  const finder = (op: string) => (ary: string[]) => ary.includes(op);
  const op1Value = operatorOrder.findIndex(finder(op1));
  const op2Value = operatorOrder.findIndex(finder(op2));
  return (op1Value <= op2Value);
};

const placeholderMap: Record<string, string> = {
  '->': '=>',
};
const requiresPlaceholder = (token: string): boolean => placeholderMap.hasOwnProperty(token);
const getPlaceholder = (token: string): string => placeholderMap[token];

/**
 * Convert tokens from infix notation to reverse polish notation, following order of operations and
 * respecting parentheses.
 */
const convertToRPN = (tokens: string[]): RPNTokenList => {
  const logRPN: boolean = false;
  const log = (...args: unknown[]) => { if (logRPN) console.log(...args); };
  log(`convertToRPN(${tokens.join(' ')})`);
  const result: string[] = [];
  const operatorStack: string[] = [];
  const logState = () => log(`result: '${result.join(' ')}' | ops: [${operatorStack.map(op => `'${op}'`).join(', ')}]`);
  tokens.forEach(token => {
    logState();
    if (requiresPlaceholder(token)) {
      if (operatorStack.length > 0 && peek(operatorStack) !== '(') {
        log(`result << ops.pop('${peek(operatorStack)}')`);
        result.push(operatorStack.pop() as string);
      }
      log(`ops << '${getPlaceholder(token)}'`);
      operatorStack.push(getPlaceholder(token));
    }
    if (isOperator(token)) {
      while (operatorStack.length > 0 && op1Precedes(token, peek(operatorStack) as string)) {
        log(`result << ops.pop('${peek(operatorStack)}')`);
        result.push(operatorStack.pop() as string);
      }
      log(`ops << '${token}'`);
      operatorStack.push(token);
    } else if (token === '(') {
      log(`ops << '${token}'`);
      operatorStack.push(token);
    } else if (token === ')') {
      while (operatorStack.length > 0 && peek(operatorStack) !== '(') {
        log(`result << ops.pop('${peek(operatorStack)}')`);
        result.push(operatorStack.pop() as string);
      }
      log(`ops.pop ('${peek(operatorStack)}')`);
      operatorStack.pop();
    } else {
      log(`result << '${token}'`);
      result.push(token);
    }
  });
  log('EOF');
  while (operatorStack.length > 0) {
    log(`result << ops.pop('${peek(operatorStack)}')`);
    result.push(operatorStack.pop() as string);
  }
  logState();
  return result;
};

export default convertToRPN;
