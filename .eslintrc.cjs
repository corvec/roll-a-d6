module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    es2022: true,
    node: true,
    jest: true,
  },
  rules: {
    // The codebase intentionally calls .hasOwnProperty() on plain object literals,
    // where it is safe. Object.hasOwn() would require raising the runtime target.
    'no-prototype-builtins': 'off',
  },
  ignorePatterns: ['dist/', 'cjs/', 'jsdoc/', 'types/', 'node_modules/'],
};
