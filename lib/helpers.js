/**
 * @example
 * // returns { a: 2, b: 4 }
 * Object.entries({ a: 1, b: 2 }).map(([k,v]) => [k, v*2]).reduce(objectMakerReducerHelper, {})
 */
export const objectMakerReduceHelper = (accum, [key, val]) => ({ ...accum, [key]: val });

/**
 * @example
 * // returns { a: 1 }
 * removeFromObject('b', { a: 1, b: 2 })
 *
 * @param {string} key The key to remove
 * @param {Object} obj The object to update
 */
export const removeFromObject = (key, { [key]: _, ...otherEntities }) => ({ ...otherEntities });

export const renameObjectKey = (oldKey, newKey, { [oldKey]: value, ...otherEntities}) => (
  {
    [newKey]: value,
    ...otherEntities
  }
);

export const renameObjectKeyPreserveOrder = (oldKey, newKey, obj) =>
  Object.entries(obj)
    .map(([key, val]) => key === oldKey ? [newKey, val] : [key, val])
    .reduce(objectMakerReduceHelper, {});

export const getPropertyByPath = (value, path) =>
  (path.length === 0
    ? value
    : value && typeof value === 'object'
      ? getPropertyByPath(value[path[0]], path.slice(1))
      : undefined);

export const getUniqueName = (name, container) => {
  if (!container.hasOwnProperty(name)) {
    return name;
  }
  let i = 1;
  const getName = () => `${name} ${i}`;
  while (container.hasOwnProperty(getName())) {
    i += 1;
  }
  return getName();
};

