import {
  getTargetCollection,
  isConditional,
  isExpansionOperator,
  isOperator,
  isRoll,
  isSideEffectOperator,
  isSideEffectVariable,
  stripPrefix,
  stripSuffix,
  variableTargetsCollection,
} from './formulaTokenizer.js';
import { objectMakerReduceHelper, peek } from './helpers.js';
import type {
  EvaluationResult,
  MacroMap,
  RandomNumberGenerator,
  ResultEntry,
  RollLog,
  RPNTokenList,
  SideEffects,
} from './types.js';

// Toggle this on if you would like messages logged throughout evaluateFormula
const logEvaluate: boolean = false;
const log = (...args: unknown[]) => { if (logEvaluate) console.log(...args); };

/**
 * Values pushed onto the evaluation stack. In addition to computed results,
 * the conditional markers ('=>', '->') and side effect variable names
 * (e.g., '$foo') are temporarily held on the stack as strings.
 */
type StackValue = ResultEntry;

/**
 * @param token Operator being applied
 * @param v1 Second value on the stack
 * @param v2 Top value on the stack
 */
const evaluate = (token: string, v1: StackValue, v2: StackValue): ResultEntry => {
  // The engine relies on JavaScript coercion when booleans meet arithmetic
  // operators (e.g., the '#&' expansion seeds its accumulator with `true`).
  const n1 = v1 as number;
  const n2 = v2 as number;
  switch (token) {
    case '+':
      return n1 + n2;
    case '-':
      return n1 - n2;
    case '*':
      return n1 * n2;
    case '/':
      return Math.floor(n1 / n2);
    case '>':
      return n1 > n2;
    case '<':
      return n1 < n2;
    case '>>':
      return n1 > n2 ? n1 : n2;
    case '<<':
      return n1 < n2 ? n1 : n2;
    case '>=':
      return n1 >= n2;
    case '<=':
      return n1 <= n2;
    case '<>':
      return v1 !== v2;
    case '==':
      return v1 === v2;
    case '||':
      return v1 || v2;
    case '&&':
      return v1 && v2;
    default:
      throw new Error(`Unknown token: ${token}`);
  }
};

const getInitialRollIndex = (sides: number[]): Record<number, number> =>
  sides.map((side): [string, number] => [`${side}`, 0]).reduce(objectMakerReduceHelper, {});

const isBoolean = (token: StackValue): boolean => [true, false, 'true', 'false'].includes(token as boolean | string);
const boolMap: Record<string, boolean> = { true: true, false: false };
const toBoolean = (token: string): boolean | string => (boolMap.hasOwnProperty(token) ? boolMap[token] : token);

const isMacro = (token: string, macros: MacroMap): boolean => macros.hasOwnProperty(stripPrefix(token));

/**
 * @example // returns 'atk@melee'
 * getMacroName('^atk@melee[0]')
 */
const getMacroName = (token: string): string => {
  const target = variableTargetsCollection(token) ? getTargetCollection(token) : null;
  return `${stripPrefix(stripSuffix(token))}${target ? `@${target}` : ''}`;
};

/**
 * @example // returns '1'
 * getMacroIndex('a[1]')
 */
const getMacroIndex = (token: string): string => (token.match(/[[{](\d+)[}\]]/) as RegExpMatchArray)[1];

/**
 * (Local) Macro instances take the form of foo[1] and are not shared across multiple expressions
 */
const isMacroInstance = (token: string, macros: MacroMap): boolean => {
  if (/[a-zA-Z]\w*\[\d+]/.test(stripPrefix(token))) {
    const macroName = getMacroName(token);
    return macros.hasOwnProperty(macroName);
  }
  return false;
};

/**
 * Global Macro instances take the form of foo{1} and are shared across all expressions
 */
const isGlobalMacroInstance = (token: string, macros: MacroMap): boolean => {
  if (/[a-zA-Z]\w*{\d+}/.test(stripPrefix(token))) {
    const macroName = getMacroName(token);
    return macros.hasOwnProperty(macroName);
  }
  return false;
};

/** Memoized macro instance results, keyed by macro name and then instance index. */
type MacroInstanceStore = Record<string, ResultEntry[]>;

/**
 * Return the memoized result for a macro instance token (e.g., 'foo[1]' or 'foo{1}'),
 * evaluating and recording it on first use.
 */
const memoizeInstance = (
  store: MacroInstanceStore,
  token: string,
  evaluateInstance: () => ResultEntry,
): ResultEntry => {
  const macroName = getMacroName(token);
  const macroIndex = parseInt(getMacroIndex(token), 10);

  if (!Array.isArray(store[macroName])) {
    store[macroName] = [];
  }
  if (store[macroName].hasOwnProperty(macroIndex)) {
    return store[macroName][macroIndex];
  }
  const result = evaluateInstance();
  store[macroName][macroIndex] = result;
  return result;
};

/**
 * Owns all of the mutable state for a single evaluateFormula run: the roll log and
 * its replay cursor, the applied side effects, and the memoized global macro
 * instances. Every mutation goes through one of its methods; the rest of this
 * module is a pure function of (expression, context).
 */
class EvaluationContext {
  /** Available macros that could be referenced */
  readonly macros: MacroMap;
  /** Map from number of sides to roll results; appended to as new dice are rolled */
  readonly rolls: RollLog;
  /** Side effects applied this run */
  readonly sideEffects: SideEffects = {};
  private readonly rng: RandomNumberGenerator;
  /** Map from number of sides to the index of the next saved roll to replay */
  private readonly rollIndex: Record<number, number>;
  /** Memoized results of global macro instances (foo{1}), shared across expressions */
  private readonly globalInstances: MacroInstanceStore = {};

  constructor({ macros, rolls, rng }: {
    macros: MacroMap;
    rolls: RollLog;
    rng: RandomNumberGenerator;
  }) {
    this.macros = macros;
    this.rolls = rolls;
    this.rng = rng;
    this.rollIndex = getInitialRollIndex(Object.keys(rolls).map(sides => parseInt(sides, 10)));
  }

  /**
   * Roll a dice token (e.g., '3d6') and return the sum.
   */
  rollDice(token: string): number {
    const count = parseInt(token.slice(0, token.indexOf('d')), 10) || 1;
    const sides = parseInt(token.slice(1 + token.indexOf('d')), 10);
    return [...Array(count).keys()].reduce((accum) => accum + this.rollDie(sides), 0);
  }

  /**
   * Roll a single die, replaying the next saved roll when one is available and
   * generating (and logging) a new roll otherwise.
   */
  private rollDie(sides: number): number {
    if (this.rollIsSaved(sides)) {
      const rollResult = this.rolls[sides][this.rollIndex[sides]];
      this.rollIndex[sides] += 1;
      return parseInt(rollResult, 10);
    }
    return this.addRoll(sides);
  }

  private rollIsSaved(sides: number): boolean {
    return typeof this.rollIndex[sides] === 'number'
      && this.rollIndex[sides] < this.rolls[sides].length;
  }

  private addRoll(sides: number): number {
    const rollResult = Math.floor(sides * this.rng()) + 1;
    if (!this.rolls.hasOwnProperty(sides)) {
      this.rolls[sides] = [];
    }
    this.rolls[sides].push(`${rollResult}(d${sides})`);
    return rollResult;
  }

  hasSideEffect(name: string): boolean {
    return this.sideEffects.hasOwnProperty(name);
  }

  getSideEffect(name: string): ResultEntry {
    return this.sideEffects[name];
  }

  /** Apply the ':=' side effect. */
  setSideEffect(name: string, value: ResultEntry): void {
    this.sideEffects[name] = value;
  }

  /**
   * Apply a '+=' or '-=' side effect (pass a negative delta for '-=').
   * `currentValue` is only invoked when no side effect has been recorded for
   * the variable yet, to seed it with the variable's pre-adjustment value.
   */
  adjustSideEffect(name: string, delta: number, currentValue: () => ResultEntry): void {
    if (!this.hasSideEffect(name)) {
      this.sideEffects[name] = currentValue();
    }
    this.sideEffects[name] = (this.sideEffects[name] as number) + delta;
  }

  /**
   * Return the memoized result for a global macro instance (foo{1}), evaluating
   * it on first use. Global instances are shared across all expressions.
   */
  memoizeGlobalInstance(token: string, evaluateInstance: () => ResultEntry): ResultEntry {
    return memoizeInstance(this.globalInstances, token, evaluateInstance);
  }
}

const getExpansionOperatorData = (expansionOperator: string): { operator: string; initialValue: ResultEntry } => ({
  '#+': {
    operator: '+',
    initialValue: 0,
  },
  '#*': {
    operator: '*',
    initialValue: 1,
  },
  '#&': {
    operator: '&&',
    initialValue: true,
  },
  '#|': {
    operator: '||',
    initialValue: false,
  },
}[expansionOperator] as { operator: string; initialValue: ResultEntry });

const applyEvaluation = (expansionOperator: string, values: StackValue[]): ResultEntry => {
  const { operator, initialValue } = getExpansionOperatorData(expansionOperator);
  return values.reduce((accum, value) => evaluate(operator, accum, value), initialValue);
};

const evaluateExpansionOperator = (
  stack: StackValue[],
  token: string,
  tokenIndex: number,
  expression: RPNTokenList,
  context: EvaluationContext,
): StackValue[] => {
  if (stack.length < 2) {
    throw new Error(`Expansion operator ${token} called with ${stack.length} operands (needs at least 2).`);
  }
  const repetitionCount = stack.slice(-2)[0] as number;
  if (repetitionCount <= 1) {
    return [...stack.slice(0, -2), stack.slice(-1)[0]];
  }
  const repeatedValue = expression[tokenIndex - 1];
  if (isRoll(repeatedValue) || isMacro(repeatedValue, context.macros)) {
    const expandedValues = [
      stack.slice(-1)[0],
      ...([...Array(repetitionCount - 1)].map(
        () => (
          isRoll(repeatedValue)
            ? context.rollDice(repeatedValue)
            : evaluateExpression(context.macros[getMacroName(repeatedValue)], context)
        ),
      )),
    ];
    const newValue = applyEvaluation(token, expandedValues);
    log(`complex expansion: ${stack.slice(-2).join(' ')} ${token} => ${newValue}`);
    return [...stack.slice(0, -2), newValue];
  } else {
    const newValue = applyEvaluation(token, [...Array(repetitionCount)].map(() => stack.slice(-1)[0]));
    log(`simple expansion: ${stack.slice(-2).join(' ')} ${token} => ${newValue}`);
    return [...stack.slice(0, -2), newValue];
  }
};

const evaluateOperator = (stack: StackValue[], token: string): StackValue[] => {
  if (stack.length < 2) {
    throw new Error(`Operator ${token} called with ${stack.length} operands (needs at least 2).`);
  } else {
    const [v1, v2] = stack.slice(-2);
    const newValue = evaluate(token, v1, v2);
    log(`${stack.slice(-2).join(' ')} ${token} => ${newValue}`);
    return [...stack.slice(0, -2), newValue];
  }
};

const evaluateValue = (
  stack: StackValue[],
  token: string,
  context: EvaluationContext,
  localInstances: MacroInstanceStore,
): StackValue[] => {
  const { macros } = context;
  const evaluateNamedMacro = () => evaluateExpression(macros[getMacroName(token)], context);
  const value = isRoll(token) ? context.rollDice(token)
    : isMacro(token, macros)
      ? context.hasSideEffect(getMacroName(token))
        ? context.getSideEffect(getMacroName(token))
        : evaluateNamedMacro()
      : isGlobalMacroInstance(token, macros) ? context.memoizeGlobalInstance(token, evaluateNamedMacro)
        : isMacroInstance(token, macros) ? memoizeInstance(localInstances, token, evaluateNamedMacro)
          : isBoolean(token) ? toBoolean(token)
            : parseInt(token, 10);
  log(`${token} => ${value}`);
  return [...stack, value];
};

const applySideEffect = (
  stack: StackValue[],
  token: string,
  context: EvaluationContext,
): StackValue[] => {
  const variableName = getMacroName(stack[stack.length - 2] as string);
  const val = peek(stack) as number;
  const currentValue = (): ResultEntry =>
    (isMacro(variableName, context.macros)
      ? evaluateExpression(context.macros[variableName], context)
      : 0);
  switch (token) {
    case ':=':
      context.setSideEffect(variableName, peek(stack) as ResultEntry);
      break;
    case '+=':
      context.adjustSideEffect(variableName, val, currentValue);
      break;
    case '-=':
      context.adjustSideEffect(variableName, -val, currentValue);
      break;
    default:
      throw new Error(`applySideEffect - invalid token(${token}).`);
  }
  return stack.slice(0, -2);
};

// When we get a conditional placeholder (=>), check the top of the stack.
// If it's truthy, then just keep the stack as is.
// If it's falsy, then add => to the stack, which will clear anything added until we encounter ->
// When we encounter a THEN (->), check the top of the stack.
// If it's =>, clear => from the stack and continue.
// Otherwise, add -> to the stack.
// Finally, when we encounter ELSE (;), check the top of the stack.
// If it's ->, clear it from the stack.
// Otherwise, just return the stack.
const evaluateConditional = (stack: StackValue[], token: string): StackValue[] => {
  switch (token) {
    case '=>': // placeholder
      if (peek(stack)) {
        return stack;
      } else {
        return [...stack, token];
      }
    case '->':
      if (peek(stack) === '=>') {
        return stack.slice(0, -1);
      } else {
        return [...stack, token];
      }
    case ';':
      if (peek(stack) === '->') {
        return stack.slice(0, -1);
      } else {
        return stack;
      }
    default:
      throw new Error('Invalid conditional setup');
  }
};

const evaluateExpression = (expression: RPNTokenList, context: EvaluationContext): ResultEntry => {
  // Memoized local macro instances (foo[1]) live only as long as a single expression
  const localInstances: MacroInstanceStore = {};
  log(`evaluating ${expression && expression.join(' ')}`);
  const result = expression.reduce((stack: StackValue[], token, tokenIndex) => {
    const top = peek(stack);
    if (isConditional(token)) {
      return evaluateConditional(stack, token);
    } else if ((typeof top === 'string' && isConditional(top)) || token === '...') {
      // skip tokens on an un-traversed conditional path, and the '...' separator
      return stack;
    } else if (isSideEffectVariable(token)) {
      return [...stack, token];
    } else if (isSideEffectOperator(token)) {
      return applySideEffect(stack, token, context);
    } else if (isExpansionOperator(token)) {
      return evaluateExpansionOperator(stack, token, tokenIndex, expression, context);
    } else if (isOperator(token)) {
      return evaluateOperator(stack, token);
    } else {
      return evaluateValue(stack, token, context, localInstances);
    }
  }, []);
  return result[result.length - 1];
};

/**
 * Calculate the result of tokenized RPN expressions
 * @param p.expressions Expressions to evaluate
 * @param p.macros Macros referenced by these expressions / by other macros
 * @param p.rolls Saved rolls (by number of sides), in case of reevaluation
 * @param p.rng Source of randomness for new dice rolls; defaults to Math.random.
 *              Inject a seeded generator for deterministic results.
 */
const evaluateFormula = (
  { expressions, macros, rolls = {}, rng = Math.random }: {
    expressions: RPNTokenList[];
    macros: MacroMap;
    rolls?: RollLog;
    rng?: RandomNumberGenerator;
  },
): EvaluationResult => {
  const context = new EvaluationContext({ macros, rolls, rng });
  const result = expressions.map(expression => evaluateExpression(expression, context));
  return { result, rolls: context.rolls, sideEffects: context.sideEffects };
};

export default evaluateFormula;
