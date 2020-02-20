const conditionals = ['->', ';', '=>'];
const logicals = ['&&', '||'];
const comparators = ['>', '<', '<=', '>=', '==', '<>', '>>', '<<'];
const arithmetic = ['+', '-', '*', '/'];
const expansion = ['#+', '#*', '#|', '#&'];
const sideEffects = [':=','+=','-=', '...'];

/**
 * Used for order of operations
 * @type {string[][]}
 */
const operatorOrder = [
  ['(', ')'], conditionals, expansion, logicals, comparators, ['+', '-'], ['*', '/'], sideEffects
];

const isConditional = token => conditionals.includes(token);
const isOperator = token => [...arithmetic, ...comparators, ...logicals, ...expansion, ...conditionals, ...sideEffects].includes(token);
const isExpansionOperator = token => expansion.includes(token);
const isSideEffectOperator = token => sideEffects.includes(token);

const isVariable = token => (/^[\^$]?[a-zA-Z]\w*(@[A-Za-z]\w*)?$/.test(token));
const isVariableInstance = token => (/^[a-zA-Z]\w*(\[\d+]|{\d+})(@[A-Za-z]\w*)?$/.test(token));
const isSideEffectVariable = token => (/^\$[a-zA-Z]\w*(@[A-Za-z]\w*)?$/.test(token));

const isNumber = token => !isNaN(token) && ['string','number'].includes(typeof token)
  && !isNaN(parseInt(token, 10));

const isRoll = token => /\d+d\d+/.test(token);
const isGrouping = token => ['(', ')'].includes(token);

const isValue = token => isVariable(token) || isVariableInstance(token) || isRoll(token) || isNumber(token) || token === '?';

const isValidToken = token => isOperator(token) || isValue(token) || isGrouping(token) || ['=', '?'].includes(token);


const targetCollectionRegex = /@[A-Za-z]\w+$/;
const variableTargetsCollection = token => (targetCollectionRegex.test(token));
const getTargetCollection = token => {
  const match = token.match(targetCollectionRegex);
  return match && match[0].slice(1);
};


const stripPrefix = variable => variable.replace(/^[\^$]+/, '');
const stripSuffix = variableInstance => variableInstance
  .replace(/@[A-Z]\w*$/, '')
  .replace(/(\[.*]|{.*})$/, '');

/**
 * @example // returns [['a'],['c']]
 * splitTokenList(['a', ',', 'c'])
 *
 * @param {string[]} tokens
 * @returns {string[][]}
 */
const splitTokenList = tokens => tokens.reduce((accum, token) => {
  if (token === ',') {
    return [...accum, []];
  } else {
    return [
      ...accum.slice(0, -1),
      [
        ...accum[accum.length - 1],
        token,
      ],
    ];
  }
}, [[]]);

const tokenRegex = /([\^$]?[A-Za-z]\w*(\[\d+]|{\d+})?(@[A-Za-z]\w*)?|\w+\b|[()]|[:+\-]=|\.\.\.|->|#[+*&|]|[+*/,;]|[<>=]{1,2}|[|]{2}|&&|\B-\d+|-|\?)/g;

/**
 * tokenize - convert a formula from a string into an array of tokens
 * Each token should represent either a value or an operator.
 *
 * @param formula (String), e.g., '1d20+5'
 * @returns Array of strings, e.g., ['1d20', '+', '5']
 */
const tokenize = formula => formula.match(tokenRegex);

export default tokenize;
export {
  arithmetic,
  logicals,
  comparators,
  expansion,
  getTargetCollection,
  isConditional,
  isExpansionOperator,
  isGrouping,
  isNumber,
  isOperator,
  isRoll,
  isSideEffectOperator,
  isSideEffectVariable,
  isValidToken,
  isValue,
  isVariableInstance,
  isVariable,
  operatorOrder,
  splitTokenList,
  stripSuffix,
  stripPrefix,
  variableTargetsCollection,
};

