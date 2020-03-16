/**
 * @param {string} token Operator being applied
 * @param {string|number|boolean} v1 Top value on the stack
 * @param {string|number|boolean} v2 Second value on the stack
 * @returns {boolean|number|*}
 */
declare function evaluate(token: string, v1: string | number | boolean, v2: string | number | boolean): boolean | number | any;

/**
 * If `rolls` was provided (and thus, we have a `rollIndex`), then return the next roll.
 * Otherwise, generate the next roll and save it into rolls.
 * @param {number} sides
 * @param {EvaluationMetadata} evaluationMetadata
 * @returns {number}
 */
declare function rollAD(sides: number, evaluationMetadata: EvaluationMetadata): number;

/**
 * @param {number[]} sides
 * @returns {object.<number, number>}
 */
declare function getInitialRollIndex(sides: number[]): {
    [key: number]: number;
};

/**
 * @function
 * @example // returns 'atk@melee'
 * getMacroName('^atk@melee[0]')
 * @param {string} token
 * @returns {string}
 */
declare function getMacroName(token: string): string;

/**
 * @function
 * @example // returns '1'
 * getMacroIndex('a[1]')
 * @param {string} token
 * @returns {string | *}
 */
declare function getMacroIndex(token: string): string | any;

/**
 * (Local) Macro instances take the form of foo[1] and are not shared across multiple expressions
 *
 * @param {string} token
 * @param {object} macros
 * @returns {boolean}
 */
declare function isMacroInstance(token: string, macros: any): boolean;

/**
 * Global Macro instances take the form of foo{1} and are shared across all expressions
 *
 * @param {string} token
 * @param {Array.<string>} macros
 * @returns {boolean}
 */
declare function isGlobalMacroInstance(token: string, macros: string[]): boolean;

/**
 * @param {RPNTokenList} expression
 * @param {EvaluationMetadata} evaluationMetadata
 * @returns {ResultEntry}
 */
declare function evaluateExpression(expression: RPNTokenList, evaluationMetadata: EvaluationMetadata): ResultEntry;

/**
 * @typedef ResultEntry
 * @type {boolean|number|string}
 */
declare type ResultEntry = boolean | number | string;

/**
 * @typedef RollLog
 * @type {object.<number, string[]>}
 */
declare type RollLog = {
    [key: number]: string[];
};

/**
 * @typedef SideEffects
 * @type {object.<string, ResultEntry>}
 */
declare type SideEffects = {
    [key: string]: ResultEntry;
};

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
declare type EvaluationMetadata = {
    macros: Collection;
    rolls: RollLog;
    rollIndex: {
        [key: number]: number;
    };
    savedGlobalValues: {
        [key: string]: ResultEntry[];
    };
    sideEffects: SideEffects;
};

/**
 * @typedef EvaluationResult
 * @type {object}
 * @property {ResultEntry[]} result Result of each expression, in order
 * @property {RollLog} rolls Log of all rolls made as part of the evaluation
 * @property {SideEffects} sideEffects Changes to already calculated values, both internal to this
 *                                     evaluation and external
 */
declare type EvaluationResult = {
    result: ResultEntry[];
    rolls: RollLog;
    sideEffects: SideEffects;
};

/**
 * Calculate the result of tokenized RPN expressions
 * @param {object} p
 * @param {Array<RPNTokenList>} p.expressions Expressions to evaluate
 * @param {MacroMap} p.macros Macros referenced by these expressions / by other macros
 * @param {object<number,string[]>} [p.rolls={}] Saved rolls (by number of sides), in case of reevaluation
 *
 * @returns {EvaluationResult}
 */
declare function evaluateFormula(p: {
    expressions: RPNTokenList[];
    macros: MacroMap;
    rolls?: {
        [key: number]: string[];
    };
}): EvaluationResult;

/**
 * Transform a formula from the collection into a "main" token list and helper token lists
 * @function convertFormulaToRoll
 *
 * @param {RPNTokenList} tokens
 * @param {string} macroName
 *
 * @returns {CollectionRoll|null}
 */
declare function convertFormulaToRoll(tokens: RPNTokenList, macroName: string): CollectionRoll | null;

/**
 * Convert formulas from the collection(s) into a usable object, already converted to RPN.
 * NOTE: In order to be usable in this way, the collection formula must have exactly 1 "main" expression.
 *       Formulas with 0 or 2+ main expressions are filtered out.
 * @function getMacrosFromCollection
 *
 * @example // returns { roll: { formula: ['1d20', 'bonus', '+'], helpers: { bonus: ['10'] } } }
 * getMacrosFromCollection({ 'roll': '1d20+bonus,bonus=10'})
 *
 * @param {object.<string, string>} collectionFormulasMap - String formulas, basically as entered by the user
 *
 * @returns {Collection}
 */
declare function getMacrosFromCollection(collectionFormulasMap: {
    [key: string]: string;
}): Collection;

/**
 * @typedef RollType
 * @type {('roll'|'value'|'roll-with-unknowns'|'value-with-unknowns')}
 */
declare type RollType = 'roll' | 'value' | 'roll-with-unknowns' | 'value-with-unknowns';

/**
 * @param {string[]} expressions
 * @param {MacroMap} macros
 * @param {string[]} unknowns
 * @returns {RollType}
 */
declare function getRollType(expressions: string[], macros: MacroMap, unknowns: string[]): RollType;

/**
 * @typedef RollMetadata
 * @type {object}
 * @property {MacroMap} internalMacros - list of macros we are using that are part of the formula
 * @property {MacroMap} externalMacros - list of macros we are using sourced from Collections
 * @property {string[]} unknownVariables - list of referenced variables that are not set
 * @property {string[]} noPromptVariables - list of unknown variables we are not supposed to prompt for
 * @property {object.<string, object.<string, string[]>>} targetedCollections - targeted variables grouped by collection
 * @property {Array.<string>} sideEffects - list of variables that could have side effects applied
 * @property {string} type - Type of the Roll - 'value', 'roll', or value/roll with unknowns
 *
 */
declare type RollMetadata = {
    internalMacros: MacroMap;
    externalMacros: MacroMap;
    unknownVariables: string[];
    noPromptVariables: string[];
    targetedCollections: {
        [key: string]: {
            [key: string]: string[];
        };
    };
    sideEffects: string[];
    type: string;
};

/**
 * Generate a list of details for a roll:
 * * external macros
 * * unknown variables
 * * internal macros
 * * unknown variables that we should not prompt for
 * * variables that are intended to come from different collections
 * * variables that have side effects
 *
 *
 * @param {string} formula
 * @param {Collection} macrosFromCollection
 * @returns {RollMetadata}
 */
declare function getRollMetadata(formula: string, macrosFromCollection: Collection): RollMetadata;

/**
 * Returns a reducer helper that will, given a list of already known variables, return a list of
 * any variables not already listed.
 *
 * @param {object<string, string>} variables The variables that are already known
 * @returns {function(string[], RPNTokenList): string[]}
 */
declare function getNewVariablesReduceHelper(variables: {
    [key: string]: string;
}): (...params: any[]) => any;

/**
 * @typedef UnassignedVariablesAndUsedMacros
 * @type {object}
 * @property {string[]} variables - The unassigned variables
 * @property {MacroMap} usedMacros - Macros that have been referenced and that thus need to be pulled in
 */
declare type UnassignedVariablesAndUsedMacros = {
    variables: string[];
    usedMacros: MacroMap;
};

/**
 * Given one or more expressions, determine which macros are needed, and pull in only those.
 *
 * @param {RPNTokenList[]} expressions - The expressions that are being evaluated.
 * @param {MacroMap} macros - Macros internal to the expression
 * @param {Collection} [macrosFromCollection={}]
 *
 * @returns {UnassignedVariablesAndUsedMacros}
 */
declare function getUnassignedVariablesAndUsedMacros(expressions: RPNTokenList[], macros: MacroMap, macrosFromCollection?: Collection): UnassignedVariablesAndUsedMacros;

/**
 * A list of tokens in Reverse Polish Notation, e.g., ['1d6','5','+']
 * @typedef RPNTokenList
 * @type {string[]}
 */
declare type RPNTokenList = string[];

/**
 * A map from var names to their tokenized expressions.
 * @typedef MacroMap
 * @type {object.<string, RPNTokenList>}
 */
declare type MacroMap = {
    [key: string]: RPNTokenList;
};

/**
 * A single Collection formula, converted from the user-entered form into a tokenized, usable object.
 * @typedef CollectionRoll
 * @type {object}
 * @property {RPNTokenList} formula The main expression associated with this macro
 * @property {MacroMap} helpers The helper macros for the main expression
 */
declare type CollectionRoll = {
    formula: RPNTokenList;
    helpers: MacroMap;
};

/**
 * Map from names to rolls that have been converted to RPN and are thus available for evaluation
 * @typedef Collection
 * @type {object.<string, CollectionRoll>}
 */
declare type Collection = {
    [key: string]: CollectionRoll;
};

/**
 * @typedef ParsedAssignments
 * @type {object}
 * @property {object.<string, number>} assignments - references to the clauses by index
 * @property {string[][]} strippedClauses - clauses without the assignments
 */
declare type ParsedAssignments = {
    assignments: {
        [key: string]: number;
    };
    strippedClauses: string[][];
};

/**
 * Get the assignments from a set of tokenized, but not RPNed, clauses.
 * In the response, the assignments will reference the clauses by index.
 * @function parseAssignments
 *
 * @param {string[][]} clauses
 *
 * @returns {ParsedAssignments}
 */
declare function parseAssignments(clauses: string[][]): ParsedAssignments;

/**
 * @typedef ParsedTokenList
 * @type {object}
 * @property {RPNTokenList[]} expressions - Top level expressions
 * @property {MacroMap} macros - Internal macros
 * @property {string[]} unassignedVariables - Variables that are referenced but not assigned
 * @property {string[]} noPromptVariables - Unassigned variables that should not be prompted for
 */
declare type ParsedTokenList = {
    expressions: RPNTokenList[];
    macros: MacroMap;
    unassignedVariables: string[];
    noPromptVariables: string[];
};

/**
 * Parse tokens in preparation for evaluation or analysis
 * @function parseTokens
 *
 * @param {string[]} tokens Token list in infix notation
 *
 * @returns {ParsedTokenList}
 */
declare function parseTokens(tokens: string[]): ParsedTokenList;

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
declare const operatorOrder: string[][];

/**
 * @function
 * @param {string} token
 * @return {boolean}
 */
declare function isConditional(token: string): boolean;

/**
 * @function
 * @param {string} token
 * @return {boolean}
 */
declare function isOperator(token: string): boolean;

/**
 * @function
 * @param {string} token
 * @return {boolean}
 */
declare function isExpansionOperator(token: string): boolean;

/**
 * @function
 * @param {string} token
 * @return {boolean}
 */
declare function isSideEffectOperator(token: string): boolean;

/**
 * @function
 * @param {string} token
 * @return {boolean}
 */
declare function isVariable(token: string): boolean;

/**
 * @function
 * @param {string} token
 * @return {boolean}
 */
declare function isVariableInstance(token: string): boolean;

/**
 * @function
 * @param {string} token
 * @return {boolean}
 */
declare function isSideEffectVariable(token: string): boolean;

/**
 * @function
 * @param {string} token
 * @return {boolean}
 */
declare function isNumber(token: string): boolean;

/**
 * Is the token a roll (e.g., '3d6')?
 * @function isRoll
 * @param {string} token
 * @returns {boolean}
 */
declare function isRoll(token: string): boolean;

/**
 * Is the token a grouping operator (either '(' or ')')?
 * @function isGrouping
 * @param {string} token
 * @returns {boolean}
 */
declare function isGrouping(token: string): boolean;

/**
 * Is the token a dice roll (e.g., '3d6')?
 * @function isValue
 * @param {string} token
 * @returns {boolean}
 */
declare function isValue(token: string): boolean;

/**
 * Is the token valid?
 * @function isValidToken
 * @param {string} token
 * @returns {boolean}
 */
declare function isValidToken(token: string): boolean;

/**
 * Is this token a variable with a target collection (e.g., 'ac@Defender', which targets 'Defender')
 * @function variableTargetsCollection
 * @param {string} token
 * @returns {boolean}
 */
declare function variableTargetsCollection(token: string): boolean;

/**
 * Get the name of the targeted collection
 * @function getTargetCollection
 * @example // returns 'Defender'
 * getTargetCollection('ac@Defender')
 * @param {string} token
 * @returns {string?}
 */
declare function getTargetCollection(token: string): string;

/**
 * Strip ^ and $ prefixes off of a token that is a variable name
 * @function stripPrefix
 * @example // returns 'ac'
 * stripPrefix('^ac')
 * @param {string} variable
 * @returns {string}
 */
declare function stripPrefix(variable: string): string;

/**
 * Strip target and instance suffixes off of a token that is a variable instance
 * @function stripSuffix
 * @example // returns 'atk'
 * stripPrefix('atk[1]')
 * @param {string} variableInstance
 * @returns {string}
 */
declare function stripSuffix(variableInstance: string): string;

/**
 * Split a tokenized list into multiple tokenized lists based on the comma token
 * @function splitTokenList
 * @example // returns [['a'],['c']]
 * splitTokenList(['a', ',', 'c'])
 *
 * @param {string[]} tokens
 * @returns {string[][]}
 */
declare function splitTokenList(tokens: string[]): string[][];

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
declare function tokenize(formula: string): string[];

/**
 * This helper enables mapping over the entries in an object that is being used like a Map.
 * @function objectMakerReduceHelper
 * @example // returns { a: 2, b: 4 }
 * Object.entries({ a: 1, b: 2 }).map(([k,v]) => [k, v*2]).reduce(objectMakerReducerHelper, {})
 * @param {object} accum (Accumulator) This accumulates the return values of this function
 * @param {Array} currentValue The next key-value pair to be added to the accumulator
 * @returns {object}
 */
declare function objectMakerReduceHelper(accum: any, currentValue: any[]): any;

/**
 * Safely descend into the object and retrieve the value at the described path
 * @function getPropertyByPath
 * @example // returns 5
 * getPropertyByPath({a: {b: [[],[5]]}}, ['a',b',1,0])
 * @param {any} value
 * @param {Array<string>} path
 * @return {any}
 */
declare function getPropertyByPath(value: any, path: string[]): any;

/**
 * Return the last entry in the array, like Array.pop(), but without changing the array
 * @function peek
 * @param {any[]} array
 * @returns {any} The last entry in the array, or undefined if the array is empty.
 */
declare function peek(array: any[]): any;

/**
 * Converts the Rolls object into a flat array
 * @function getAllRolls
 * @example // returns ['1d6', '3d6', '15d20', '4d20']
 * getAllRolls({ 6: ['1d6', '3d6'], 20: ['15d20', '4d20'] })
 *
 * @param {object.<number, string[]>} rolls
 * @returns {string[]}
 */
declare function getAllRolls(rolls: {
    [key: number]: string[];
}): string[];

/**
 * @typedef ResultRange
 * @type {object}
 * @property {ResultEntry} result The result when evaluated in this range
 * @property {string} variable The name of the variable
 * @property {number} minValue The lowest value for which this result is applicable
 * @property {number} maxValue The highest value for which this result is applicable
 */
declare type ResultRange = {
    result: ResultEntry;
    variable: string;
    minValue: number;
    maxValue: number;
};

/**
 * Determine the result given different values of a single input, and build the ResultRange to model
 * this.
 * @function buildResultRange
 * @param {object} p
 * @param {RPNTokenList[]} p.expressions
 * @param {Function} p.macrosWithCertainty
 * @param {string[]} p.rolls
 * @param {string[]} p.uncertainValues
 * @param {ResultEntry[]} p.result
 * @param {number} p.maxRange
 * @param {SideEffects} p.initialSideEffects
 * @returns {ResultRange[]}
 */
declare function buildResultRange(p: {
    expressions: RPNTokenList[];
    macrosWithCertainty: (...params: any[]) => any;
    rolls: string[];
    uncertainValues: string[];
    result: ResultEntry[];
    maxRange: number;
    initialSideEffects: SideEffects;
}): ResultRange[];

/**
 * @typedef RolledFormula
 * @type {object}
 * @property {ResultEntry[]|ResultRange[]} result Either the results from evaluation OR an array
 *                                      of results at multiple input values for a given variable
 * @property {RollLog} rolls Log of all rolls made as part of the evaluation
 * @property {SideEffects} sideEffects Side effects applied from this roll
 * @property {MacroMap} macros Macros that were included in the initial expression
 * @property {MacroMap} allMacros All macros - expression, collection, and inline
 */
declare type RolledFormula = {
    result: ResultEntry[] | ResultRange[];
    rolls: RollLog;
    sideEffects: SideEffects;
    macros: MacroMap;
    allMacros: MacroMap;
};

/**
 * Validate, parse, and evaluate a formula, potentially pulling in collection data if needed
 * @function rollFormula
 * @param {string} formula
 * @param {object.<string,string>} collectionFormulasMap
 * @returns {RolledFormula}
 */
declare function rollFormula(formula: string, collectionFormulasMap: {
    [key: string]: string;
}): RolledFormula;

/**
 * @param {string} op1
 * @param {string} op2
 * @returns {boolean} True if op1 is of higher precedence than operator 2,
 * e.g., a op1 b op2 c should be grouped as (a op1 b) op2 c
 */
declare function op1Precedes(op1: string, op2: string): boolean;

/**
 * Convert tokens from infix notation to reverse polish notation, following order of operations and
 * respecting parentheses.
 *
 * @param {string[]} tokens
 * @returns {RPNTokenList}
 */
declare function convertToRPN(tokens: string[]): RPNTokenList;

/**
 * Ensure parentheses are balanced
 * @function validateParentheses
 * @example
 * // returns false
 * validateParentheses('())(')
 * // return false
 * validateParentheses('(()')
 * // return true
 * validateParentheses('()')
 *
 * @param {string} clause
 * @returns {boolean} True if valid
 */
declare function validateParentheses(clause: string): boolean;

/**
 * confirm that brackets are only used to contain numbers, e.g., [5]
 *
 * @param {string} clause
 * @returns {boolean} True if valid
 */
declare function validateBrackets(clause: string): boolean;

/**
 * confirm that operators and values alternate
 * @function validateAlternatingTokenType
 * @param {string[]} tokens
 * @returns {boolean} True if valid
 */
declare function validateAlternatingTokenType(tokens: string[]): boolean;

/**
 * Confirm that the clause matches the appropriate format and that the other validators pass
 * @function validateClause
 * @param {string} clause
 * @param {number|string} i clause descriptor
 * @returns {string[]} Empty if valid. Array of found issues.
 */
declare function validateClause(clause: string, i: number | string): string[];

/**
 * Ensure that assignment only happens at the beginning of a clause
 * @function clauseHasMislocatedAssignmentOperator
 * @param {string[]} clause List of tokens
 * @returns {boolean} True if valid
 */
declare function clauseHasMislocatedAssignmentOperator(clause: string[]): boolean;

/**
 * Perform validation for the entire formula (an unconverted string) one clause at a time
 * @function validateFormula
 * @param {string} formula
 * @returns {string[]} Empty if valid. Array of issues found.
 */
declare function validateFormula(formula: string): string[];

