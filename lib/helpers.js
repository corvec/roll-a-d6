/**
 * This helper enables mapping over the entries in an object that is being used like a Map.
 * @example // returns { a: 2, b: 4 }
 * Object.entries({ a: 1, b: 2 }).map(([k,v]) => [k, v*2]).reduce(objectMakerReducerHelper, {})
 * @param {object} accum (Accumulator) This accumulates the return values of this function
 * @param {Array} currentValue The next key-value pair to be added to the accumulator
 * @returns {object}
 */
export const objectMakerReduceHelper = (accum, [key, val]) => ({ ...accum, [key]: val });

/**
 * Safely descend into the object and retrieve the value at the described path
 * @example // returns 5
 * getPropertyByPath({a: {b: [[],[5]]}}, ['a',b',1,0])
 * @param {any} value
 * @param {Array<string>} path
 * @return {any}
 */
export const getPropertyByPath = (value, path) =>
  (path.length === 0
    ? value
    : value && typeof value === 'object'
      ? getPropertyByPath(value[path[0]], path.slice(1))
      : undefined);

/**
 * @function
 * Return the last entry in the array, like Array.pop(), but without changing the array
 * @param {any[]} array
 * @returns {any} The last entry in the array, or undefined if the array is empty.
 */
export const peek = array => Array.isArray(array) && array.length > 0 ? array[array.length - 1] : undefined;

/**
 * @function
 * @example // returns ['1d6', '3d6', '15d20', '4d20']
 * getAllRolls({ 6: ['1d6', '3d6'], 20: ['15d20', '4d20'] })
 *
 * @param {object.<number, string[]>} rolls
 * @returns {string[]}
 */
export const getAllRolls = rolls => Object.values(rolls).reduce((accum, newRolls) => [...accum, ...newRolls], []);
