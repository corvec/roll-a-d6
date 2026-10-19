import { peek } from './helpers.js';
import {
  isFunctionCallToken,
  isOperator,
  isRoll,
  isVariable,
  operatorOrder,
} from './formulaTokenizer.js';
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

/** Is this token a plain (unprefixed) name that can start a function call? */
const isCallableName = (token: string): boolean =>
  isVariable(token) && !token.startsWith('^') && !token.startsWith('$');

interface FunctionFrame {
  /** Index in the output token list where the function-call token sits, patched on ')' */
  outIndex: number;
  name: string;
  /** Number of stack values the call will consume */
  args: number;
}

/**
 * Rewrite function-call syntax before the shunting-yard pass:
 * * A name directly followed by '(' becomes a function-call token carrying its argument
 *   count (e.g., 'max:2'), placed before its '('.
 * * A spread of a dice roll used directly as an argument (e.g., '...3d6') is merged into
 *   a single spread token, and counts as one stack value per die.
 */
const preprocessFunctionCalls = (tokens: string[]): string[] => {
  const result: string[] = [];
  /** One entry per open paren: a FunctionFrame for call parens, null for plain groups */
  const frames: (FunctionFrame | null)[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const next = tokens[i + 1];
    if (token === '(') {
      frames.push(null);
      result.push(token);
    } else if (token === ')') {
      const frame = frames.pop();
      if (frame) {
        result[frame.outIndex] = `${frame.name}:${frame.args}`;
      }
      result.push(token);
    } else if (isCallableName(token) && next === '(') {
      result.push(token); // patched to 'name:argCount' when the matching ')' is reached
      frames.push({ outIndex: result.length - 1, name: token, args: 1 });
      result.push('(');
      i += 1;
    } else if (token === ',') {
      const frame = peek(frames);
      if (!frame) {
        throw new Error('Commas are only allowed between function-call arguments, e.g., max(1d6,5).');
      }
      frame.args += 1;
      result.push(token);
    } else if (token === '...' && (i === 0 || ['(', ','].includes(tokens[i - 1]))) {
      const frame = peek(frames);
      const after = tokens[i + 2];
      if (frame && isRoll(next ?? '') && [',', ')'].includes(after ?? '')) {
        // each die contributes one stack value, replacing the single value counted for this argument
        frame.args += (parseInt(next, 10) || 1) - 1;
        result.push(`...${next}`);
        i += 1;
      } else {
        throw new Error('Spread (...) is only supported on a dice roll used directly as a function argument, e.g., max(...3d6,5).');
      }
    } else {
      result.push(token);
    }
  }
  return result;
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
  const preprocessedTokens = preprocessFunctionCalls(tokens);
  const result: string[] = [];
  const operatorStack: string[] = [];
  const logState = () => log(`result: '${result.join(' ')}' | ops: [${operatorStack.map(op => `'${op}'`).join(', ')}]`);
  const flushConditionalContext = () => {
    while (operatorStack.length > 0 && !['(', ';'].includes(peek(operatorStack) as string)) {
      log(`result << ops.pop('${peek(operatorStack)}')`);
      result.push(operatorStack.pop() as string);
    }
  };
  preprocessedTokens.forEach(token => {
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
    } else if (isFunctionCallToken(token)) {
      // The call token waits beneath its '(' and is emitted after its arguments
      log(`ops << '${token}'`);
      operatorStack.push(token);
    } else if (token === ',') {
      while (operatorStack.length > 0 && peek(operatorStack) !== '(') {
        log(`result << ops.pop('${peek(operatorStack)}')`);
        result.push(operatorStack.pop() as string);
      }
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
      if (operatorStack.length > 0 && isFunctionCallToken(peek(operatorStack) as string)) {
        log(`result << ops.pop('${peek(operatorStack)}')`);
        result.push(operatorStack.pop() as string);
      }
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
