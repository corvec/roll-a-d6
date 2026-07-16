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
  EvaluationMetadata,
  EvaluationResult,
  MacroMap,
  RandomNumberGenerator,
  ResultEntry,
  RollLog,
  RPNTokenList,
} from './types.js';

// TODO: [Tech Debt] Refactor this module to not mutate savedMacroValues or evaluationMetadata

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


/**
 * If `rolls` was provided (and thus, we have a `rollIndex`), then return the next roll.
 * Otherwise, generate the next roll and save it into rolls.
 */
const rollAD = (sides: number, evaluationMetadata: EvaluationMetadata): number => {
  if (rollIsSaved(sides, evaluationMetadata)) {
    const rollResult = evaluationMetadata.rolls[sides][evaluationMetadata.rollIndex[sides]];
    evaluationMetadata.rollIndex[sides] += 1;
    return parseInt(rollResult, 10);
  } else {
    return addRoll(sides, evaluationMetadata);
  }
};

const getInitialRollIndex = (sides: number[]): Record<number, number> =>
  sides.map((side): [string, number] => [`${side}`, 0]).reduce(objectMakerReduceHelper, {});

const rollIsSaved = (sides: number, evaluationMetadata: EvaluationMetadata): boolean =>
  typeof evaluationMetadata.rollIndex[sides] === 'number'
    && evaluationMetadata.rollIndex[sides] < evaluationMetadata.rolls[sides].length;

const addRoll = (sides: number, evaluationMetadata: EvaluationMetadata): number => {
  const rollResult = Math.floor(sides * evaluationMetadata.rng()) + 1;
  if (!evaluationMetadata.rolls.hasOwnProperty(sides)) {
    evaluationMetadata.rolls[sides] = [];
  }
  evaluationMetadata.rolls[sides].push(`${rollResult}(d${sides})`);
  return rollResult;
};

const rollRoll = (token: string, evaluationMetadata: EvaluationMetadata): number => {
  const count = parseInt(token.slice(0, token.indexOf('d')), 10) || 1;
  const sides = parseInt(token.slice(1 + token.indexOf('d')), 10);
  return [...Array(count).keys()].reduce((accum) => accum + rollAD(sides, evaluationMetadata), 0);
};

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

const getOrEvalMacroInstance = (
  token: string,
  evaluationMetadata: EvaluationMetadata,
  savedMacroValues: Record<string, ResultEntry[]>,
): ResultEntry => {
  const macroName = getMacroName(token);
  const macroIndex = parseInt(getMacroIndex(token), 10);

  if (!Array.isArray(savedMacroValues[macroName])) {
    savedMacroValues[macroName] = [];
  }
  if (savedMacroValues[macroName].hasOwnProperty(macroIndex)) {
    return savedMacroValues[macroName][macroIndex];
  }
  const result = evaluateExpression(evaluationMetadata.macros[macroName], evaluationMetadata);
  savedMacroValues[macroName][macroIndex] = result;
  return result;
};

interface ExpansionOperatorData {
  operator: string;
  initialValue: ResultEntry;
}

const getExpansionOperatorData = (expansionOperator: string): ExpansionOperatorData => ({
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
}[expansionOperator] as ExpansionOperatorData);

const applyEvaluation = (expansionOperator: string, values: StackValue[]): ResultEntry => {
  const { operator, initialValue } = getExpansionOperatorData(expansionOperator);
  return values.reduce((accum, value) => evaluate(operator, accum, value), initialValue);
};

const evaluateExpansionOperator = (
  { stack, token, tokenIndex, expression, evaluationMetadata }: {
    stack: StackValue[];
    token: string;
    tokenIndex: number;
    expression: RPNTokenList;
    evaluationMetadata: EvaluationMetadata;
  },
): StackValue[] => {
  if (stack.length < 2) {
    throw new Error(`Expansion operator ${token} called with ${stack.length} operands (needs at least 2).`);
  }
  const repetitionCount = stack.slice(-2)[0] as number;
  if (repetitionCount <= 1) {
    return [...stack.slice(0, -2), stack.slice(-1)[0]];
  }
  const repeatedValue = expression[tokenIndex - 1];
  if (isRoll(repeatedValue) || isMacro(repeatedValue, evaluationMetadata.macros)) {
    const expandedValues = [
      stack.slice(-1)[0],
      ...([...Array(repetitionCount - 1)].map(
        () => (
          isRoll(repeatedValue)
            ? rollRoll(repeatedValue, evaluationMetadata)
            : evaluateExpression(evaluationMetadata.macros[getMacroName(repeatedValue)], evaluationMetadata)
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

const evaluateOperator = ({ stack, token }: { stack: StackValue[]; token: string }): StackValue[] => {
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
  { stack, token, savedMacroValues, evaluationMetadata }: {
    stack: StackValue[];
    token: string;
    savedMacroValues: Record<string, ResultEntry[]>;
    evaluationMetadata: EvaluationMetadata;
  },
): StackValue[] => {
  const { macros } = evaluationMetadata;
  const value = isRoll(token) ? rollRoll(token, evaluationMetadata)
    : isMacro(token, macros)
      ? evaluationMetadata.sideEffects.hasOwnProperty(getMacroName(token))
        ? evaluationMetadata.sideEffects[getMacroName(token)]
        : evaluateExpression(macros[getMacroName(token)], evaluationMetadata)
      : isGlobalMacroInstance(token, macros) ? getOrEvalMacroInstance(token, evaluationMetadata, evaluationMetadata.savedGlobalValues)
        : isMacroInstance(token, macros) ? getOrEvalMacroInstance(token, evaluationMetadata, savedMacroValues)
          : isBoolean(token) ? toBoolean(token)
            : parseInt(token, 10);
  log(`${token} => ${value}`);
  return [...stack, value];
};

const storeCurrentValue = (
  { variableName, evaluationMetadata }: {
    variableName: string;
    evaluationMetadata: EvaluationMetadata;
  },
): void => {
  evaluationMetadata.sideEffects[variableName] =
    isMacro(variableName, evaluationMetadata.macros)
      ? evaluateExpression(evaluationMetadata.macros[variableName], evaluationMetadata)
      : 0;
};

const applySideEffect = (
  { stack, token, evaluationMetadata }: {
    stack: StackValue[];
    token: string;
    evaluationMetadata: EvaluationMetadata;
  },
): StackValue[] => {
  const variableName = getMacroName(stack[stack.length - 2] as string);
  const val = peek(stack);
  switch (token) {
    case ':=':
      evaluationMetadata.sideEffects[variableName] = val as ResultEntry;
      break;
    case '+=':
      if (!evaluationMetadata.sideEffects.hasOwnProperty(variableName)) {
        storeCurrentValue({ variableName, evaluationMetadata });
      }
      evaluationMetadata.sideEffects[variableName] = (evaluationMetadata.sideEffects[variableName] as number) + (val as number);
      break;
    case '-=':
      if (!evaluationMetadata.sideEffects.hasOwnProperty(variableName)) {
        storeCurrentValue({ variableName, evaluationMetadata });
      }
      evaluationMetadata.sideEffects[variableName] = (evaluationMetadata.sideEffects[variableName] as number) - (val as number);
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
const evaluateConditional = ({ stack, token }: { stack: StackValue[]; token: string }): StackValue[] => {
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

// used to avoid traversing the falsy path with if-then conditionals
const ignoreToken = ({ stack }: { stack: StackValue[] }): StackValue[] => stack;

const evaluateExpression = (expression: RPNTokenList, evaluationMetadata: EvaluationMetadata): ResultEntry => {
  // Preserve the values of macros within a single expression
  const savedMacroValues: Record<string, ResultEntry[]> = {};
  log(`evaluating ${expression && expression.join(' ')}`);
  const result = expression.reduce((stack: StackValue[], token, tokenIndex) => {
    const top = peek(stack);
    if (isConditional(token)) {
      return evaluateConditional({ stack, token });
    } else if ((typeof top === 'string' && isConditional(top)) || token === '...') {
      return ignoreToken({ stack });
    } else if (isSideEffectVariable(token)) {
      return [...stack, token];
    } else if (isSideEffectOperator(token)) {
      return applySideEffect({ stack, token, evaluationMetadata });
    } else if (isExpansionOperator(token)) {
      return evaluateExpansionOperator({ stack, token, tokenIndex, expression, evaluationMetadata });
    } else if (isOperator(token)) {
      return evaluateOperator({ stack, token });
    } else {
      return evaluateValue({ stack, token, evaluationMetadata, savedMacroValues });
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
  const evaluationMetadata: EvaluationMetadata = {
    macros,
    rng,
    rolls,
    rollIndex: getInitialRollIndex(Object.keys(rolls).map(sides => parseInt(sides, 10))),
    savedGlobalValues: {},
    sideEffects: {},
  };
  const result = expressions.map(expression => evaluateExpression(
    expression, evaluationMetadata,
  ));
  return { result, rolls: evaluationMetadata.rolls, sideEffects: evaluationMetadata.sideEffects };
};

export default evaluateFormula;
