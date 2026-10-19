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

/**
 * Convert tokens from infix notation to reverse polish notation, following order of operations and
 * respecting parentheses.
 *
 * Conditionals chain as else-if without explicit parentheses: `a->b;c->d;e` is converted as if it
 * were written `a->b;(c->d;e)`. This works because '->' and ';' flush pending operators only up to
 * the nearest '(' or ';', so each else-branch keeps its own conditional context.
 */
const convertToRPN = (tokens: string[]): RPNTokenList => {
  const logRPN: boolean = false;
  const log = (...args: unknown[]) => { if (logRPN) console.log(...args); };
  log(`convertToRPN(${tokens.join(' ')})`);
  const result: string[] = [];
  const operatorStack: string[] = [];
  const logState = () => log(`result: '${result.join(' ')}' | ops: [${operatorStack.map(op => `'${op}'`).join(', ')}]`);
  const flushConditionalContext = () => {
    while (operatorStack.length > 0 && !['(', ';'].includes(peek(operatorStack) as string)) {
      log(`result << ops.pop('${peek(operatorStack)}')`);
      result.push(operatorStack.pop() as string);
    }
  };
  tokens.forEach(token => {
    logState();
    if (token === '->') {
      // Flush the condition's pending operators, then emit the placeholder that
      // the evaluator uses to decide whether to take or skip the then-branch.
      flushConditionalContext();
      log(`result << '${placeholderMap[token]}' | ops << '${token}'`);
      result.push(placeholderMap[token]);
      operatorStack.push(token);
    } else if (token === ';') {
      // Flush the then-branch (including its '->'), but stop at '(' or an outer
      // ';' so that chained else-if conditionals nest to the right.
      flushConditionalContext();
      log(`ops << '${token}'`);
      operatorStack.push(token);
    } else if (isOperator(token)) {
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
