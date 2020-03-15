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
 * @param {RPNTokenList[]} p.expressions Expressions to evaluate
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

