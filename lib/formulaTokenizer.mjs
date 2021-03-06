export const conditionals = ['->', ';', '=>'];
export const logicals = ['&&', '||'];
export const comparators = ['>', '<', '<=', '>=', '==', '<>', '>>', '<<'];
export const arithmetic = ['+', '-', '*', '/'];
export const expansion = ['#+', '#*', '#|', '#&'];
export const sideEffects = [':=','+=','-=', '...'];

/**
 * Used for order of operations when converting to RPN. Earlier groups have a higher precedence than later groups.
 * @example // 5+(6*7)
 * 5+6*7
 * @example // (5+6)>(7*8)
 * 5+6>7*8
 * @example // (5>6)|(7<8)
 * 5>6|7<8
 * @example // ((10+1d4)>>1d20)#+(6+1d6)
 * 10+1d4>>1d20#+6+1d6
 * @example // (((10+1d4)>>1d20)#+(6+1d6)<20)->1d8;0
 * 10+1d4>>1d20#+6+1d6->1d8;0
 *
 * @type {string[][]}
 */
export const operatorOrder = [
  ['(', ')'], conditionals, expansion, logicals, comparators, ['+', '-'], ['*', '/'], sideEffects
];

/**
 * @function
 * @param {string} token
 * @returns {boolean}
 */
export const isConditional = token => conditionals.includes(token);
/**
 * @function
 * @param {string} token
 * @returns {boolean}
 */
export const isOperator = token => [...arithmetic, ...comparators, ...logicals, ...expansion, ...conditionals, ...sideEffects].includes(token);
/**
 * @function
 * @param {string} token
 * @returns {boolean}
 */
export const isExpansionOperator = token => expansion.includes(token);
/**
 * @function
 * @param {string} token
 * @returns {boolean}
 */
export const isSideEffectOperator = token => sideEffects.includes(token);

/**
 * @function
 * @param {string} token
 * @returns {boolean}
 */
export const isVariable = token => (/^[\^$]?[a-zA-Z]\w*(@[A-Za-z]\w*)?$/.test(token));
/**
 * @function
 * @param {string} token
 * @returns {boolean}
 */
export const isVariableInstance = token => (/^[a-zA-Z]\w*(\[\d+]|{\d+})(@[A-Za-z]\w*)?$/.test(token));
/**
 * @function
 * @param {string} token
 * @returns {boolean}
 */
export const isSideEffectVariable = token => (/^\$[a-zA-Z]\w*(@[A-Za-z]\w*)?$/.test(token));

/**
 * @function
 * @param {string} token
 * @returns {boolean}
 */
export const isNumber = token => !isNaN(token) && ['string','number'].includes(typeof token)
  && !isNaN(parseInt(token, 10));

/**
 * Is the token a roll (e.g., '3d6')?
 * @function isRoll
 * @param {string} token
 * @returns {boolean}
 */
export const isRoll = token => /\d+d\d+/.test(token);
/**
 * Is the token a grouping operator (either '(' or ')')?
 * @function isGrouping
 * @param {string} token
 * @returns {boolean}
 */
export const isGrouping = token => ['(', ')'].includes(token);

/**
 * Is the token a dice roll (e.g., '3d6')?
 * @function isValue
 * @param {string} token
 * @returns {boolean}
 */
export const isValue = token => isVariable(token) || isVariableInstance(token) || isRoll(token) || isNumber(token) || token === '?';

/**
 * Is the token valid?
 * @function isValidToken
 * @param {string} token
 * @returns {boolean}
 */
export const isValidToken = token => isOperator(token) || isValue(token) || isGrouping(token) || ['=', '?'].includes(token);


const targetCollectionRegex = /@[A-Za-z]\w+$/;
/**
 * Is this token a variable with a target collection (e.g., 'ac@Defender', which targets 'Defender')
 * @function variableTargetsCollection
 * @param {string} token
 * @returns {boolean}
 */
export const variableTargetsCollection = token => (targetCollectionRegex.test(token));
/**
 * Get the name of the targeted collection
 * @function getTargetCollection
 * @example // returns 'Defender'
 * getTargetCollection('ac@Defender')
 * @param {string} token
 * @returns {string?}
 */
export const getTargetCollection = token => {
  const match = token.match(targetCollectionRegex);
  return match && match[0].slice(1);
};


/**
 * Strip ^ and $ prefixes off of a token that is a variable name
 * @function stripPrefix
 * @example // returns 'ac'
 * stripPrefix('^ac')
 * @param {string} variable
 * @returns {string}
 */
export const stripPrefix = variable => variable.replace(/^[\^$]+/, '');
/**
 * Strip target and instance suffixes off of a token that is a variable instance
 * @function stripSuffix
 * @example // returns 'atk'
 * stripPrefix('atk[1]')
 * @param {string} variableInstance
 * @returns {string}
 */
export const stripSuffix = variableInstance => variableInstance
  .replace(/@[A-Z]\w*$/, '')
  .replace(/(\[.*]|{.*})$/, '');

/**
 * Split a tokenized list into multiple tokenized lists based on the comma token
 * @function splitTokenList
 * @example // returns [['a'],['c']]
 * splitTokenList(['a', ',', 'c'])
 *
 * @param {string[]} tokens
 * @returns {string[][]}
 */
export const splitTokenList = tokens => tokens.reduce((accum, token) => {
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

/**
 * Every token MUST match this Regex.
 * @private
 * @type {RegExp}
 */
const tokenRegex = /([\^$]?[A-Za-z]\w*(\[\d+]|{\d+})?(@[A-Za-z]\w*)?|\w+\b|[()]|[:+\-]=|\.\.\.|->|#[+*&|]|[+*/,;]|[<>=]{1,2}|[|]{2}|&&|\B-\d+|-|\?)/g;

/**
 * Convert a formula from a string into an array of tokens
 * Each token should represent either a value or an operator.
 * @function tokenize
 * @example // returns ['1d20', '+', '5']
 * tokenize('1d20+5')
 *
 * @param {string} formula
 * @returns {string[]} Array of tokens
 */
export const tokenize = formula => formula.match(tokenRegex);

export default tokenize;
