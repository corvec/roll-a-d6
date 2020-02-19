import {
  getTargetCollection,
  isExpansionOperator,
  isOperator,
  isRoll,
  stripPrefix,
  stripSuffix,
} from './formulaTokenizer';

const logEvaluate = false;
const log = (...args) => { if (logEvaluate) console.log(...args); }

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
    case '->': // then
      return v1 ? v2 : false;
    case ';': // else
      return v1 !== false ? v1 : v2;
    default:
      throw new Error(`Unknown token: ${token}`);
  }
};


const rollAD = (sides, rolls, rollIndex) => {
  if (Array.isArray(rollIndex)) {
    const rollResult = rolls[rollIndex[0]];
    rollIndex[0] += 1;
    return parseInt(rollResult, 10);
  } else {
    const rollResult = Math.floor(sides * Math.random()) + 1;
    rolls.push(`${rollResult}(d${sides})`);
    return rollResult;
  }
};

const rollRoll = (token, rolls, rollIndex) => {
  const count = parseInt(token.slice(0, token.indexOf('d')), 10) || 1;
  const sides = parseInt(token.slice(1 + token.indexOf('d')), 10);
  return [...Array(count).keys()].reduce((accum) => accum + rollAD(sides, rolls, rollIndex), 0);
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

const isMacroInstance = (token, macros) => {
  if (/[a-zA-Z]\w*\[\d+]/.test(stripPrefix(token))) {
    const macroName = getMacroName(token);
    return macros.hasOwnProperty(macroName);
  }
  return false;
};

const isGlobalMacroInstance = (token, macros) => {
  if (/[a-zA-Z]\w*{\d+}/.test(stripPrefix(token))) {
    const macroName = getMacroName(token);
    return macros.hasOwnProperty(macroName);
  }
  return false;
};

const getOrEvalMacroInstance = (token, macros, rolls, savedGlobalValues, savedMacroValues, rollIndex) => {
  const macroName = getMacroName(token);
  const macroIndex = parseInt(getMacroIndex(token), 10);

  if (!Array.isArray(savedMacroValues[macroName])) {
    savedMacroValues[macroName] = [];
  }
  if (savedMacroValues[macroName].hasOwnProperty(macroIndex)) {
    return savedMacroValues[macroName][macroIndex];
  }
  const result = evaluateExpression(macros[macroName], macros, rolls, savedGlobalValues, rollIndex);
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

const evaluateExpansionOperator = ({ stack, token, tokenIndex, expression, macros, rolls, savedGlobalValues, rollIndex }) => {
  if (stack.length < 2) {
    throw new Error(`Expansion operator ${token} called with ${stack.length} operands (needs at least 2).`);
  }
  const repetitionCount = stack.slice(-2)[ 0 ];
  if (repetitionCount <= 1) {
    return [...stack.slice(0, -2), stack.slice(-1)[0]];
  }
  const repeatedValue = expression[ tokenIndex - 1 ];
  if (isRoll(repeatedValue) || isMacro(repeatedValue, macros)) {
    const expandedValues = [
      stack.slice(-1)[0],
      ...([...Array(repetitionCount-1)].map(
        () => (
          isRoll(repeatedValue)
            ? rollRoll(repeatedValue, rolls, rollIndex)
            : evaluateExpression(macros[getMacroName(repeatedValue)], macros, rolls, savedGlobalValues, rollIndex)
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

const evaluateValue = ({ stack, token, rolls, macros, savedGlobalValues, savedMacroValues, rollIndex }) => {
  const value = isRoll(token) ? rollRoll(token, rolls, rollIndex)
    : isMacro(token, macros) ? evaluateExpression(macros[getMacroName(token)], macros, rolls, savedGlobalValues, rollIndex)
    : isGlobalMacroInstance(token, macros) ? getOrEvalMacroInstance(token, macros, rolls, savedGlobalValues, savedGlobalValues, rollIndex)
    : isMacroInstance(token, macros) ? getOrEvalMacroInstance(token, macros, rolls, savedGlobalValues, savedMacroValues, rollIndex)
    : isBoolean(token) ? toBoolean(token)
    : parseInt(token, 10);
  log(`${token} => ${value}`);
  return [...stack, value];
};

const evaluateExpression = (expression, macros, rolls, savedGlobalValues, rollIndex) => {
  const savedMacroValues = {};
  log(`evaluating ${expression && expression.join(' ')}`);
  const result = expression.reduce((stack, token, tokenIndex) => {
    if (isExpansionOperator(token)) {
      return evaluateExpansionOperator({ stack, token, tokenIndex, expression, macros, rolls, savedGlobalValues, rollIndex });
    } else if (isOperator(token)) {
      return evaluateOperator({ stack, token });
    } else {
      return evaluateValue({ stack, token, rolls, macros, savedGlobalValues, savedMacroValues, rollIndex });
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
  // TODO: [Tech Debt] Keep track of individual rolls / rollIndex without mutation
  const rollIndex = (rolls.length > 0) ? [0] : undefined;
  const savedGlobalValues = {};
  const result = expressions.map(expression => evaluateExpression(
    expression, macros, rolls, savedGlobalValues, rollIndex
  ));
  return { result, rolls };
};

export default evaluateFormula;
