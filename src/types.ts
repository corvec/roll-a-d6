/**
 * Shared types for the roll-a-d6 engine.
 */

/** The result of evaluating a single expression. */
export type ResultEntry = boolean | number | string;

/** A list of tokens in Reverse Polish Notation, e.g., ['1d6','5','+'] */
export type RPNTokenList = string[];

/** A map from variable/macro names to their tokenized (RPN) expressions. */
export type MacroMap = Record<string, RPNTokenList>;

/**
 * Log of rolls made, keyed by number of sides, e.g., {6: ['1(d6)','5(d6)']}
 */
export type RollLog = Record<number, string[]>;

/** Side effects applied during an evaluation, e.g., { sneakAttack: 0 } */
export type SideEffects = Record<string, ResultEntry>;

/**
 * A single Collection formula, converted from the user-entered form into a
 * tokenized, usable object.
 */
export interface CollectionRoll {
  /** The main expression associated with this macro */
  formula: RPNTokenList;
  /** The helper macros for the main expression */
  helpers: MacroMap;
}

/**
 * Map from names to rolls that have been converted to RPN and are thus
 * available for evaluation.
 */
export type MacroCollection = Record<string, CollectionRoll>;

/**
 * A collection that can be targeted by name from a formula
 * (e.g., `ac@Defender` targets the collection named `Defender`).
 */
export interface TargetedCollection {
  /** Addressable, named rolls/values */
  rolls: Record<string, string | { formula?: string }>;
  /** Child collections, cannot yet be addressed */
  collections?: Record<string, TargetedCollection>;
}

/**
 * A random number generator: returns a number in [0, 1), like Math.random.
 * Inject a seeded implementation for deterministic rolls.
 */
export type RandomNumberGenerator = () => number;

/** Metadata tracked while evaluating a set of expressions. */
export interface EvaluationMetadata {
  /** Available macros that could be referenced */
  macros: MacroMap;
  /** Source of randomness used for new dice rolls */
  rng: RandomNumberGenerator;
  /** Map from number of sides to saved roll results (e.g., {6: ['1(d6)','5(d6)']}) */
  rolls: RollLog;
  /** Map from number of sides to roll index */
  rollIndex: Record<number, number>;
  /** Saved results of global macro instances */
  savedGlobalValues: Record<string, ResultEntry[]>;
  /** Applied side effects this run */
  sideEffects: SideEffects;
}

/** The output of evaluating a full set of expressions. */
export interface EvaluationResult {
  /** Result of each expression, in order */
  result: ResultEntry[];
  /** Log of all rolls made as part of the evaluation */
  rolls: RollLog;
  /**
   * Changes to already calculated values, both internal to this evaluation
   * and external
   */
  sideEffects: SideEffects;
}
