import {
  getTargetCollection,
  isConditional,
  isExpansionOperator,
  isOperator,
  isRoll,
  stripPrefix,
  stripSuffix,
} from './formulaTokenizer';
import { peek } from './helpers';

// Toggle this on if you would like messages logged throughout evaluateFormula
const logEvaluate = false;
const log = (...args) => { if (logEvaluate) console.log(...args); };

const evaluate = (token, v1, v2) => {
  switch (token) {
    case '+':
      return v1 + v2;
    case '-':
      return v1 - v2;
    case '*':
      return v1 * v2;
    case '/':
      return Math.floor(v1 / v2);
    case '>':
      return v1 > v2;
    case '<':
      return v1 < v2;
    case '>>':
      return v1 > v2 ? v1 : v2;
    case '<<':
      return v1 < v2 ? v1 : v2;
    case '>=':
      return v1 >= v2;
    case '<=':
      return v1 <= v2;
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
 * @param {number} sides
 * @param evaluationMetadata
 * @returns {number}
 */
const rollAD = (sides, evaluationMetadata) => {
  if (typeof evaluationMetadata.rollIndex === 'number') {
    const rollResult = evaluationMetadata.rolls[evaluationMetadata.rollIndex];
    evaluationMetadata.rollIndex += 1;
    return parseInt(rollResult, 10);
  } else {
    const rollResult = Math.floor(sides * Math.random()) + 1;
    evaluationMetadata.rolls.push(`${rollResult}(d${sides})`);
    return rollResult;
  }
};

const rollRoll = (token, evaluationMetadata) => {
  const count = parseInt(token.slice(0, token.indexOf('d')), 10) || 1;
  const sides = parseInt(token.slice(1 + token.indexOf('d')), 10);
  return [...Array(count).keys()].reduce((accum) => accum + rollAD(sides, evaluationMetadata), 0);
};

const isBoolean = token => [true, false, 'true', 'false'].includes(token);
const boolMap = { true: true, false: false };
const toBoolean = token => boolMap.hasOwnProperty(token) ? boolMap[token] : token;

const isMacro = (token, macros) => macros.hasOwnProperty(stripPrefix(token));

const getMacroName = token => {
  const target = getTargetCollection(token);
  return `${stripPrefix(stripSuffix(token))}${target ? `@${target}` : ''}`;
};
const getMacroIndex = token => token.match(/[[{](\d+)[}\]]/)[1]

const isPlaceholder = token => token.match(/=>/);

/**
 * (Local) Macro instances take the form of foo[1] and are not shared across multiple expressions
 */
const isMacroInstance = (token, macros) => {
  if (/[a-zA-Z]\w*\[\d+]/.test(stripPrefix(token))) {
    const macroName = getMacroName(token);
    return macros.hasOwnProperty(macroName);
  }
  return false;
};

/**
 * Global Macro instances take the form of foo{1} and are shared across all expressions
 */
const isGlobalMacroInstance = (token, macros) => {
  if (/[a-zA-Z]\w*{\d+}/.test(stripPrefix(token))) {
    const macroName = getMacroName(token);
    return macros.hasOwnProperty(macroName);
  }
  return false;
};

const getOrEvalMacroInstance = (token, evaluationMetadata, savedMacroValues) => {
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

const getExpansionOperatorData = expansionOperator => ({
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
      initialValue: true
    },
    '#|': {
      operator: '||',
      initialValue: false,
    },
  }[expansionOperator]
);

const applyEvaluation = (expansionOperator, values) => {
  const { operator, initialValue } = getExpansionOperatorData(expansionOperator);
  return values.reduce((accum, value) => evaluate(operator, accum, value), initialValue);
};

const evaluateExpansionOperator = ({ stack, token, tokenIndex, expression, evaluationMetadata }) => {
  if (stack.length < 2) {
    throw new Error(`Expansion operator ${token} called with ${stack.length} operands (needs at least 2).`);
  }
  const repetitionCount = stack.slice(-2)[ 0 ];
  if (repetitionCount <= 1) {
    return [...stack.slice(0, -2), stack.slice(-1)[0]];
  }
  const repeatedValue = expression[ tokenIndex - 1 ];
  if (isRoll(repeatedValue) || isMacro(repeatedValue, evaluationMetadata.macros)) {
    const expandedValues = [
      stack.slice(-1)[0],
      ...([...Array(repetitionCount-1)].map(
        () => (
          isRoll(repeatedValue)
            ? rollRoll(repeatedValue, evaluationMetadata)
            : evaluateExpression(evaluationMetadata.macros[getMacroName(repeatedValue)], evaluationMetadata)
        )
      ))
    ];
    const newValue = applyEvaluation(token, expandedValues);
    log(`complex expansion: ${stack.slice(-2).join(' ')} ${token} => ${newValue}`);
    return [...stack.slice(0, -2), newValue];
  } else {
    const newValue = applyEvaluation(token, [...Array(repetitionCount)].map(_ => stack.slice(-1)[0]));
    log(`simple expansion: ${stack.slice(-2).join(' ')} ${token} => ${newValue}`);
    return [...stack.slice(0, -2), newValue];
  }
};

const evaluateOperator = ({ stack, token }) => {
  if (stack.length < 2) {
    throw new Error(`Operator ${token} called with ${stack.length} operands (needs at least 2).`);
  } else {
    const newValue = evaluate(token, ...stack.slice(-2));
    log(`${stack.slice(-2).join(' ')} ${token} => ${newValue}`);
    return [...stack.slice(0, -2), newValue];
  }
};

const evaluateValue = ({ stack, token, savedMacroValues, evaluationMetadata }) => {
  const { macros } = evaluationMetadata;
  const value = isRoll(token) ? rollRoll(token, evaluationMetadata)
    : isMacro(token, macros) ? evaluateExpression(macros[getMacroName(token)], evaluationMetadata)
    : isGlobalMacroInstance(token, macros) ? getOrEvalMacroInstance(token, evaluationMetadata, evaluationMetadata.savedGlobalValues)
    : isMacroInstance(token, macros) ? getOrEvalMacroInstance(token, evaluationMetadata, savedMacroValues)
    : isBoolean(token) ? toBoolean(token)
    : parseInt(token, 10);
  log(`${token} => ${value}`);
  return [...stack, value];
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
const evaluateConditional = ({ stack, token, evaluationMetadata }) => {
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
const ignoreToken = ({ stack }) => stack;

const evaluateExpression = (expression, evaluationMetadata) => {
  // Preserve the values of macros within a single expression
  const savedMacroValues = {};
  log(`evaluating ${expression && expression.join(' ')}`);
  const result = expression.reduce((stack, token, tokenIndex) => {
    if (isConditional(token)) {
      return evaluateConditional({ stack, token, evaluationMetadata });
    } else if (isConditional(peek(stack))) {
      return ignoreToken({ stack });
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
 * @typedef resultEntry
 * @type {boolean|number|string}
 */


/**
 * Calculate the result of tokenized RPN expressions
 * @param {tokenList[]} expressions Expressions to evaluate
 * @param {macrosObject} macros Macros referenced by these expressions / by other macros
 * @param {string[]} [rolls=[]] Saved rolls, in case of reevaluation
 *
 * @returns {Object}
 * @property {resultEntry[]} result Result of each expression, in order
 * @property {string[]} rolls Log of all rolls made as part of the evaluation
 */
const evaluateFormula = ({ expressions, macros, rolls = [] }) => {
  // TODO: [Tech Debt] Build a new evaluationMetadata object rather than mutating this one
  const evaluationMetadata = {
    macros,
    rolls,
    rollIndex: (rolls.length > 0) ? 0 : undefined,
    savedGlobalValues: {},
  };
  const result = expressions.map(expression => evaluateExpression(
    expression, evaluationMetadata,
  ));
  return { result, rolls: evaluationMetadata.rolls };
};

export default evaluateFormula;
