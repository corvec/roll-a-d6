/**
 * @example
 * // returns { a: 2, b: 4 }
 * Object.entries({ a: 1, b: 2 }).map(([k,v]) => [k, v*2]).reduce(objectMakerReducerHelper, {})
 */
export const objectMakerReduceHelper = (accum, [key, val]) => ({ ...accum, [key]: val });

export const getPropertyByPath = (value, path) =>
  (path.length === 0
    ? value
    : value && typeof value === 'object'
      ? getPropertyByPath(value[path[0]], path.slice(1))
      : undefined);

/**
 * Return the last entry in the array, like Array.pop(), but without changing the array
 * @param {*[]} array
 * @returns {*|undefined} The last entry in the array, or undefined if the array is empty.
 */
export const peek = array => Array.isArray(array) && array.length > 0 ? array[array.length - 1] : undefined;
