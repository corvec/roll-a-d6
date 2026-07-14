import type { RollLog } from './types.js';

/**
 * This helper enables mapping over the entries in an object that is being used like a Map.
 * @example // returns { a: 2, b: 4 }
 * Object.entries({ a: 1, b: 2 }).map(([k,v]) => [k, v*2]).reduce(objectMakerReduceHelper, {})
 * @param accum (Accumulator) This accumulates the return values of this function
 * @param currentValue The next key-value pair to be added to the accumulator
 */
export const objectMakerReduceHelper = <T>(
  accum: Record<string, T>,
  [key, val]: [string, T],
): Record<string, T> => ({ ...accum, [key]: val });

/**
 * Safely descend into the object and retrieve the value at the described path
 * @example // returns 5
 * getPropertyByPath({a: {b: [[],[5]]}}, ['a','b',1,0])
 */
export const getPropertyByPath = (value: unknown, path: Array<string | number>): unknown =>
  (path.length === 0
    ? value
    : value && typeof value === 'object'
      ? getPropertyByPath((value as Record<string | number, unknown>)[path[0]], path.slice(1))
      : undefined);

/**
 * Return the last entry in the array, like Array.pop(), but without changing the array
 * @returns The last entry in the array, or undefined if the array is empty.
 */
export const peek = <T>(array: T[]): T | undefined =>
  (Array.isArray(array) && array.length > 0 ? array[array.length - 1] : undefined);

/**
 * Converts the Rolls object into a flat array
 * @example // returns ['1d6', '3d6', '15d20', '4d20']
 * getAllRolls({ 6: ['1d6', '3d6'], 20: ['15d20', '4d20'] })
 */
export const getAllRolls = (rolls: RollLog): string[] =>
  Object.values(rolls).reduce((accum: string[], newRolls) => [...accum, ...newRolls], []);
