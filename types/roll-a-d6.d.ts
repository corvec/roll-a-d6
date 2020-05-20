/**
 * @param token - Operator being applied
 * @param v1 - Top value on the stack
 * @param v2 - Second value on the stack
 */
declare function evaluate(token: string, v1: string | number | boolean, v2: string | number | boolean): boolean | number | any;

/**
 * If `rolls` was provided (and thus, we have a `rollIndex`), then return the next roll.
 * Otherwise, generate the next roll and save it into rolls.
 */
declare function rollAD(sides: number, evaluationMetadata: EvaluationMetadata): number;

declare function getInitialRollIndex(sides: number[]): {
    [key: number]: number;
};

/**
 * @example
 * // returns 'atk@melee'
 * getMacroName('^atk@melee[0]')
 */
declare function getMacroName(token: string): string;

/**
 * @example
 * // returns '1'
 * getMacroIndex('a[1]')
 */
declare function getMacroIndex(token: string): string | any;

/**
 * (Local) Macro instances take the form of foo[1] and are not shared across multiple expressions
 */
declare function isMacroInstance(token: string, macros: any): boolean;

/**
 * Global Macro instances take the form of foo{1} and are shared across all expressions
 */
declare function isGlobalMacroInstance(token: string, macros: string[]): boolean;

declare function evaluateExpression(expression: RPNTokenList, evaluationMetadata: EvaluationMetadata): ResultEntry;

declare type ResultEntry = boolean | number | string;

declare type RollLog = {
    [key: number]: string[];
};

declare type SideEffects = {
    [key: string]: ResultEntry;
};

/**
 * @property macros - Available CollectionRolls that could be referenced
 * @property rolls - Map from number of sides to saved roll results
 *                              (e.g., {6: ['1(d6)','5(d6)']})
 * @property rollIndex - Map from number of sides to roll index
 * @property savedGlobalValues - Saved results of macro instances
 * @property sideEffects - Applied side effects this run
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
 * @property result - Result of each expression, in order
 * @property rolls - Log of all rolls made as part of the evaluation
 * @property sideEffects - Changes to already calculated values, both internal to this
 *                                     evaluation and external
 */
declare type EvaluationResult = {
    result: ResultEntry[];
    rolls: RollLog;
    sideEffects: SideEffects;
};

/**
 * Calculate the result of tokenized RPN expressions
 * @param p.expressions - Expressions to evaluate
 * @param p.macros - Macros referenced by these expressions / by other macros
 * @param [p.rolls = {}] - Saved rolls (by number of sides), in case of reevaluation
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
 */
declare function convertFormulaToRoll(tokens: RPNTokenList, macroName: string): CollectionRoll | null;

/**
 * Convert formulas from the collection(s) into a usable object, already converted to RPN.
 * NOTE: In order to be usable in this way, the collection formula must have exactly 1 "main" expression.
 *       Formulas with 0 or 2+ main expressions are filtered out.
 * @example
 * // returns { roll: { formula: ['1d20', 'bonus', '+'], helpers: { bonus: ['10'] } } }
 * getMacrosFromCollection({ 'roll': '1d20+bonus,bonus=10'})
 * @param collectionFormulasMap - String formulas, basically as entered by the user
 */
declare function getMacrosFromCollection(collectionFormulasMap: {
    [key: string]: string;
}): Collection;

declare type RollType = 'roll' | 'value' | 'roll-with-unknowns' | 'value-with-unknowns';

declare function getRollType(expressions: string[], macros: MacroMap, unknowns: string[]): RollType;

/**
 * @property internalMacros - list of macros we are using that are part of the formula
 * @property externalMacros - list of macros we are using sourced from Collections
 * @property unknownVariables - list of referenced variables that are not set
 * @property noPromptVariables - list of unknown variables we are not supposed to prompt for
 * @property targetedCollections - targeted variables grouped by collection
 * @property sideEffects - list of variables that could have side effects applied
 * @property type - Type of the Roll - 'value', 'roll', or value/roll with unknowns
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
 */
declare function getRollMetadata(formula: string, macrosFromCollection: Collection): RollMetadata;

/**
 * Returns a reducer helper that will, given a list of already known variables, return a list of
 * any variables not already listed.
 * @param variables - The variables that are already known
 */
declare function getNewVariablesReduceHelper(variables: {
    [key: string]: string;
}): (...params: any[]) => any;

/**
 * @property variables - The unassigned variables
 * @property usedMacros - Macros that have been referenced and that thus need to be pulled in
 */
declare type UnassignedVariablesAndUsedMacros = {
    variables: string[];
    usedMacros: MacroMap;
};

/**
 * Given one or more expressions, determine which macros are needed, and pull in only those.
 * @param expressions - The expressions that are being evaluated.
 * @param macros - Macros internal to the expression
 */
declare function getUnassignedVariablesAndUsedMacros(expressions: RPNTokenList[], macros: MacroMap, macrosFromCollection?: Collection): UnassignedVariablesAndUsedMacros;

/**
 * A list of tokens in Reverse Polish Notation, e.g., ['1d6','5','+']
 */
declare type RPNTokenList = string[];

/**
 * A map from var names to their tokenized expressions.
 */
declare type MacroMap = {
    [key: string]: RPNTokenList;
};

/**
 * A single Collection formula, converted from the user-entered form into a tokenized, usable object.
 * @property formula - The main expression associated with this macro
 * @property helpers - The helper macros for the main expression
 */
declare type CollectionRoll = {
    formula: RPNTokenList;
    helpers: MacroMap;
};

/**
 * Map from names to rolls that have been converted to RPN and are thus available for evaluation
 */
declare type Collection = {
    [key: string]: CollectionRoll;
};

/**
 * @property assignments - references to the clauses by index
 * @property strippedClauses - clauses without the assignments
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
 */
declare function parseAssignments(clauses: string[][]): ParsedAssignments;

/**
 * @property expressions - Top level expressions
 * @property macros - Internal macros
 * @property unassignedVariables - Variables that are referenced but not assigned
 * @property noPromptVariables - Unassigned variables that should not be prompted for
 */
declare type ParsedTokenList = {
    expressions: RPNTokenList[];
    macros: MacroMap;
    unassignedVariables: string[];
    noPromptVariables: string[];
};

/**
 * Parse tokens in preparation for evaluation or analysis
 * @param tokens - Token list in infix notation
 */
declare function parseTokens(tokens: string[]): ParsedTokenList;

/**
 * Used for order of operations when converting to RPN. Earlier groups have a higher precedence than later groups.
 * @example
 * // 5+(6*7)
 * 5+6*7
 * @example
 * // (5+6)>(7*8)
 * 5+6>7*8
 * @example
 * // (5>6)|(7<8)
 * 5>6|7<8
 * @example
 * // ((10+1d4)>>1d20)#+(6+1d6)
 * 10+1d4>>1d20#+6+1d6
 * @example
 * // (((10+1d4)>>1d20)#+(6+1d6)<20)->1d8;0
 * 10+1d4>>1d20#+6+1d6->1d8;0
 */
declare const operatorOrder: string[][];

declare function isConditional(token: string): boolean;

declare function isOperator(token: string): boolean;

declare function isExpansionOperator(token: string): boolean;

declare function isSideEffectOperator(token: string): boolean;

declare function isVariable(token: string): boolean;

declare function isVariableInstance(token: string): boolean;

declare function isSideEffectVariable(token: string): boolean;

declare function isNumber(token: string): boolean;

/**
 * Is the token a roll (e.g., '3d6')?
 */
declare function isRoll(token: string): boolean;

/**
 * Is the token a grouping operator (either '(' or ')')?
 */
declare function isGrouping(token: string): boolean;

/**
 * Is the token a dice roll (e.g., '3d6')?
 */
declare function isValue(token: string): boolean;

/**
 * Is the token valid?
 */
declare function isValidToken(token: string): boolean;

/**
 * Is this token a variable with a target collection (e.g., 'ac@Defender', which targets 'Defender')
 */
declare function variableTargetsCollection(token: string): boolean;

/**
 * Get the name of the targeted collection
 * @example
 * // returns 'Defender'
 * getTargetCollection('ac@Defender')
 */
declare function getTargetCollection(token: string): string;

/**
 * Strip ^ and $ prefixes off of a token that is a variable name
 * @example
 * // returns 'ac'
 * stripPrefix('^ac')
 */
declare function stripPrefix(variable: string): string;

/**
 * Strip target and instance suffixes off of a token that is a variable instance
 * @example
 * // returns 'atk'
 * stripPrefix('atk[1]')
 */
declare function stripSuffix(variableInstance: string): string;

/**
 * Split a tokenized list into multiple tokenized lists based on the comma token
 * @example
 * // returns [['a'],['c']]
 * splitTokenList(['a', ',', 'c'])
 */
declare function splitTokenList(tokens: string[]): string[][];

/**
 * Convert a formula from a string into an array of tokens
 * Each token should represent either a value or an operator.
 * @example
 * // returns ['1d20', '+', '5']
 * tokenize('1d20+5')
 * @returns Array of tokens
 */
declare function tokenize(formula: string): string[];

/**
 * This helper enables mapping over the entries in an object that is being used like a Map.
 * @example
 * // returns { a: 2, b: 4 }
 * Object.entries({ a: 1, b: 2 }).map(([k,v]) => [k, v*2]).reduce(objectMakerReducerHelper, {})
 * @param accum - (Accumulator) This accumulates the return values of this function
 * @param currentValue - The next key-value pair to be added to the accumulator
 */
declare function objectMakerReduceHelper(accum: any, currentValue: any[]): any;

/**
 * Safely descend into the object and retrieve the value at the described path
 * @example
 * // returns 5
 * getPropertyByPath({a: {b: [[],[5]]}}, ['a',b',1,0])
 */
declare function getPropertyByPath(value: any, path: string[]): any;

/**
 * Return the last entry in the array, like Array.pop(), but without changing the array
 * @returns The last entry in the array, or undefined if the array is empty.
 */
declare function peek(array: any[]): any;

/**
 * Converts the Rolls object into a flat array
 * @example
 * // returns ['1d6', '3d6', '15d20', '4d20']
 * getAllRolls({ 6: ['1d6', '3d6'], 20: ['15d20', '4d20'] })
 */
declare function getAllRolls(rolls: {
    [key: number]: string[];
}): string[];

/**
 * @property result - The result when evaluated in this range
 * @property variable - The name of the variable
 * @property minValue - The lowest value for which this result is applicable
 * @property maxValue - The highest value for which this result is applicable
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
 * @property result - Either the results from evaluation OR an array
 *                                      of results at multiple input values for a given variable
 * @property rolls - Log of all rolls made as part of the evaluation
 * @property sideEffects - Side effects applied from this roll
 * @property macros - Macros that were included in the initial expression
 * @property allMacros - All macros - expression, collection, and inline
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
 */
declare function rollFormula(formula: string, collectionFormulasMap: {
    [key: string]: string;
}): RolledFormula;

/**
 * @returns True if op1 is of higher precedence than operator 2,
 * e.g., a op1 b op2 c should be grouped as (a op1 b) op2 c
 */
declare function op1Precedes(op1: string, op2: string): boolean;

/**
 * Convert tokens from infix notation to reverse polish notation, following order of operations and
 * respecting parentheses.
 */
declare function convertToRPN(tokens: string[]): RPNTokenList;

/**
 * Ensure parentheses are balanced
 * @example
 * // returns false
 * validateParentheses('())(')
 * // return false
 * validateParentheses('(()')
 * // return true
 * validateParentheses('()')
 * @returns True if valid
 */
declare function validateParentheses(clause: string): boolean;

/**
 * confirm that brackets are only used to contain numbers, e.g., [5]
 * @returns True if valid
 */
declare function validateBrackets(clause: string): boolean;

/**
 * confirm that operators and values alternate
 * @returns True if valid
 */
declare function validateAlternatingTokenType(tokens: string[]): boolean;

/**
 * Confirm that the clause matches the appropriate format and that the other validators pass
 * @param i - clause descriptor
 * @returns Empty if valid. Array of found issues.
 */
declare function validateClause(clause: string, i: number | string): string[];

/**
 * Ensure that assignment only happens at the beginning of a clause
 * @param clause - List of tokens
 * @returns True if valid
 */
declare function clauseHasMislocatedAssignmentOperator(clause: string[]): boolean;

/**
 * Perform validation for the entire formula (an unconverted string) one clause at a time
 * @returns Empty if valid. Array of issues found.
 */
declare function validateFormula(formula: string): string[];

