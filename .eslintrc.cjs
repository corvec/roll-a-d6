module.exports = {
  parser: 'babel-eslint',
  extends: ['plugin:jsdoc/recommended'],
  parserOptions: {
    'sourceType': 'module'
  },
  plugins: ['fp'],
  env: {
    es6: true,
    node: true,
    jest: true
  },
  rules: {
    'jsdoc/require-jsdoc': 'warn',
    'jsdoc/require-param-description': 'off',
    'jsdoc/require-returns-description': 'off',
    'jsdoc/newline-after-description': 'off',
    'jsdoc/no-undefined-types': 'off',
    'fp/no-nil': 'off',
    'fp/no-unused-expression': 'off',
    'fp/no-throw': 'warn',
    'fp/no-mutation': 'warn',
  },
  ignorePatterns: ['build/']
};
