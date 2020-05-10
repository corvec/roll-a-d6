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
} from './formulaTokenizer';
import {objectMakerReduceHelper, peek} from './helpers';

// TODO: [Tech Debt] Refactor this module to not mutate savedMacroValues or evaluationMetadata
/* eslint fp/no-mutation: ['error', {
     exceptions: [
       {object: 'savedMacroValues'},
       {object: 'evaluationMetadata', property: 'rollIndex'},
       {object: 'evaluationMetadata', property: 'rolls'},
       {object: 'evaluationMetadata', property: 'sideEffects'},
     ]
  }]
*/

// Toggle this on if you would like messages logged throughout evaluateFormula
const logEvaluate = false;
const log = (...args) => { if (logEvaluate) console.log(...args); };


/**
 * @param {string} token Operator being applied
 * @param {string|number|boolean} v1 Top value on the stack
 * @param {string|number|boolean} v2 Second value on the stack
 * @returns {boolean|number|*}
 */
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
 * @param {EvaluationMetadata} evaluationMetadata
 * @returns {number}
 */
const rollAD = (sides, evaluationMetadata) => {
  if (rollIsSaved(sides, evaluationMetadata)) {
    const rollResult = evaluationMetadata.rolls[sides][evaluationMetadata.rollIndex[sides]];
    evaluationMetadata.rollIndex[sides] += 1;
    return parseInt(rollResult, 10);
  } else {
    return addRoll(sides, evaluationMetadata);
  }
};

/**
 * @param {number[]} sides
 * @returns {object.<number, number>}
 */
const getInitialRollIndex = (sides) =>
  sides.map(side => [side, 0]).reduce(objectMakerReduceHelper, {});

const rollIsSaved = (sides, evaluationMetadata) =>
    typeof evaluationMetadata.rollIndex[sides] === 'number'
    && evaluationMetadata.rollIndex[sides] < evaluationMetadata.rolls[sides].length;

const addRoll = (sides, evaluationMetadata) => {
  const rollResult = Math.floor(sides * Math.random()) + 1;
  if (!evaluationMetadata.rolls.hasOwnProperty(sides)) {
    evaluationMetadata.rolls[sides] = [];
  }
  evaluationMetadata.rolls[sides].push(`${rollResult}(d${sides})`);
  return rollResult;
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

/**
 * @function
 * @example // returns 'atk@melee'
 * getMacroName('^atk@melee[0]')
 * @param {string} token
 * @returns {string}
 */
const getMacroName = token => {
  const target = variableTargetsCollection(token) ? getTargetCollection(token) : null;
  return `${stripPrefix(stripSuffix(token))}${target ? `@${target}` : ''}`;
};
/**
 * @function
 * @example // returns '1'
 * getMacroIndex('a[1]')
 * @param {string} token
 * @returns {string | *}
 */
const getMacroIndex = token => token.match(/[[{](\d+)[}\]]/)[1];

const isPlaceholder = token => token.match(/=>/);

/**
 * (Local) Macro instances take the form of foo[1] and are not shared across multiple expressions
 *
 * @param {string} token
 * @param {object} macros
 * @returns {boolean}
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
 *
 * @param {string} token
 * @param {Array.<string>} macros
 * @returns {boolean}
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

const storeCurrentValue = ({ variableName, evaluationMetadata }) => {
  evaluationMetadata.sideEffects[variableName] =
    isMacro(variableName, evaluationMetadata.macros)
      ? evaluateExpression(evaluationMetadata.macros[variableName], evaluationMetadata)
      : 0;
};

const applySideEffect = ({ stack, token, evaluationMetadata, savedMacroValues }) => {
  const variableName = getMacroName(stack[stack.length - 2]);
  const val = peek(stack);
  switch (token) {
    case ':=':
      evaluationMetadata.sideEffects[variableName] = val;
      break;
    case '+=':
      if (!evaluationMetadata.sideEffects.hasOwnProperty(variableName)) {
        storeCurrentValue({ variableName, evaluationMetadata, savedMacroValues });
      }
      evaluationMetadata.sideEffects[variableName] = evaluationMetadata.sideEffects[variableName] + val;
      break;
    case '-=':
      if (!evaluationMetadata.sideEffects.hasOwnProperty(variableName)) {
        storeCurrentValue({ variableName, evaluationMetadata, savedMacroValues });
      }
      evaluationMetadata.sideEffects[variableName] = evaluationMetadata.sideEffects[variableName] - val;
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

/**
 * @param {RPNTokenList} expression
 * @param {EvaluationMetadata} evaluationMetadata
 * @returns {ResultEntry}
 */
const evaluateExpression = (expression, evaluationMetadata) => {
  // Preserve the values of macros within a single expression
  const savedMacroValues = {};
  log(`evaluating ${expression && expression.join(' ')}`);
  const result = expression.reduce((stack, token, tokenIndex) => {
    if (isConditional(token)) {
      return evaluateConditional({ stack, token, evaluationMetadata });
    } else if (isConditional(peek(stack)) || token === '...') {
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
 * @typedef ResultEntry
 * @type {boolean|number|string}
 */

/**
 * @typedef RollLog
 * @type {object.<number, string[]>}
 */

/**
 * @typedef SideEffects
 * @type {object.<string, ResultEntry>}
 */

/**
 * @typedef EvaluationMetadata
 * @type {object}
 * @property {Collection} macros    Available CollectionRolls that could be referenced
 * @property {RollLog} rolls    Map from number of sides to saved roll results
 *                              (e.g., {6: ['1(d6)','5(d6)']})
 * @property {object.<number, number>} rollIndex  Map from number of sides to roll index
 * @property {object.<string, ResultEntry[]>} savedGlobalValues  Saved results of macro instances
 * @property {SideEffects} sideEffects  Applied side effects this run
 */

/**
 * @typedef EvaluationResult
 * @type {object}
 * @property {ResultEntry[]} result Result of each expression, in order
 * @property {RollLog} rolls Log of all rolls made as part of the evaluation
 * @property {SideEffects} sideEffects Changes to already calculated values, both internal to this
 *                                     evaluation and external
 */

/**
 * Calculate the result of tokenized RPN expressions
 * @param {object} p
 * @param {Array<RPNTokenList>} p.expressions Expressions to evaluate
 * @param {MacroMap} p.macros Macros referenced by these expressions / by other macros
 * @param {object<number,string[]>} [p.rolls={}] Saved rolls (by number of sides), in case of reevaluation
 *
 * @returns {EvaluationResult}
 */
const evaluateFormula = ({ expressions, macros, rolls = {} }) => {
  // @type EvaluationMetadata
  const evaluationMetadata = {
    macros,
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
