module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['prettier'],
  overrides: [],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    indent: ['error', 2],
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'prettier/prettier': 'error',
    'comma-dangle': ['error', 'always-multiline'],
    'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
    'brace-style': ['error', '1tbs'],
    'padding-line-between-statements': 'off',
  },
};
