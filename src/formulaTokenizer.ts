export const conditionals = ['->', ';', '=>'];
export const logicals = ['&&', '||'];
export const comparators = ['>', '<', '<=', '>=', '==', '<>', '>>', '<<'];
export const arithmetic = ['+', '-', '*', '/'];
export const expansion = ['#+', '#*', '#|', '#&'];
export const sideEffects = [':=', '+=', '-=', '...'];

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
 */
export const operatorOrder: string[][] = [
  ['(', ')'], conditionals, expansion, logicals, comparators, ['+', '-'], ['*', '/'], sideEffects,
];

export const isConditional = (token: string): boolean => conditionals.includes(token);

export const isOperator = (token: string): boolean =>
  [...arithmetic, ...comparators, ...logicals, ...expansion, ...conditionals, ...sideEffects].includes(token);

export const isExpansionOperator = (token: string): boolean => expansion.includes(token);

export const isSideEffectOperator = (token: string): boolean => sideEffects.includes(token);

export const isVariable = (token: string): boolean =>
  /^[\^$]?[a-zA-Z]\w*(@[A-Za-z]\w*)?$/.test(token);

export const isVariableInstance = (token: string): boolean =>
  /^[a-zA-Z]\w*(\[\d+]|{\d+})(@[A-Za-z]\w*)?$/.test(token);

export const isSideEffectVariable = (token: string): boolean =>
  /^\$[a-zA-Z]\w*(@[A-Za-z]\w*)?$/.test(token);

export const isNumber = (token: string | number): boolean =>
  !Number.isNaN(Number(token)) && ['string', 'number'].includes(typeof token)
    && !Number.isNaN(parseInt(String(token), 10));

/**
 * Is the token a roll (e.g., '3d6')?
 */
export const isRoll = (token: string): boolean => /\d+d\d+/.test(token);

/**
 * Is the token a grouping operator (either '(' or ')')?
 */
export const isGrouping = (token: string): boolean => ['(', ')'].includes(token);

/**
 * Is the token a value - a variable, variable instance, dice roll, number, or '?'.
 */
export const isValue = (token: string): boolean =>
  isVariable(token) || isVariableInstance(token) || isRoll(token) || isNumber(token) || token === '?';

/**
 * Is the token valid?
 */
export const isValidToken = (token: string): boolean =>
  isOperator(token) || isValue(token) || isGrouping(token) || ['=', '?'].includes(token);


const targetCollectionRegex = /@[A-Za-z]\w+$/;

/**
 * Is this token a variable with a target collection (e.g., 'ac@Defender', which targets 'Defender')
 */
export const variableTargetsCollection = (token: string): boolean => targetCollectionRegex.test(token);

/**
 * Get the name of the targeted collection
 * @example // returns 'Defender'
 * getTargetCollection('ac@Defender')
 */
export const getTargetCollection = (token: string): string | null => {
  const match = token.match(targetCollectionRegex);
  return match && match[0].slice(1);
};


/**
 * Strip ^ and $ prefixes off of a token that is a variable name
 * @example // returns 'ac'
 * stripPrefix('^ac')
 */
export const stripPrefix = (variable: string): string => variable.replace(/^[\^$]+/, '');

/**
 * Strip target and instance suffixes off of a token that is a variable instance
 * @example // returns 'atk'
 * stripSuffix('atk[1]')
 */
export const stripSuffix = (variableInstance: string): string => variableInstance
  .replace(/@[A-Z]\w*$/, '')
  .replace(/(\[.*]|{.*})$/, '');

/**
 * Split a tokenized list into multiple tokenized lists based on the comma token
 * @example // returns [['a'],['c']]
 * splitTokenList(['a', ',', 'c'])
 */
export const splitTokenList = (tokens: string[]): string[][] => tokens.reduce(
  (accum: string[][], token) => {
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
  },
  [[]],
);

/**
 * Every token MUST match this Regex.
 */
const tokenRegex = /([\^$]?[A-Za-z]\w*(\[\d+]|{\d+})?(@[A-Za-z]\w*)?|\w+\b|[()]|[:+-]=|\.\.\.|->|#[+*&|]|[+*/,;]|[<>=]{1,2}|[|]{2}|&&|\B-\d+|-|\?)/g;

/**
 * Convert a formula from a string into an array of tokens.
 * Each token should represent either a value or an operator.
 * @example // returns ['1d20', '+', '5']
 * tokenize('1d20+5')
 *
 * @returns Array of tokens, or null if nothing in the formula matched
 */
export const tokenize = (formula: string): string[] | null => formula.match(tokenRegex);

export default tokenize;
