import stylisticJs from '@stylistic/eslint-plugin-js'
import stylisticTs from '@stylistic/eslint-plugin-ts'
import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url) // eslint-disable-line no-underscore-dangle
const __dirname = path.dirname(__filename) // eslint-disable-line no-underscore-dangle
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

export default [
  {
    ignores: [
      '**/webpack.config.ts',
      '*.mjs',
      'util/*.ts',
      'minitests/*.ts',
      'content/minitests/*.ts',
      '**/node_modules',
      '**/*.d.ts',
      '**/mini',
      '**/*.js',
    ],
  },
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking'
  ),
  {
    plugins: {
      '@typescript-eslint': typescriptEslintEslintPlugin,
      '@stylistic/js': stylisticJs,
      '@stylistic/ts': stylisticTs,
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 5,
      sourceType: 'module',

      parserOptions: {
        project: 'tsconfig.json',
      },
    },

    rules: {
      '@typescript-eslint/no-explicit-any': 'off',

      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array' }],

      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/dot-notation': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@stylistic/js/indent': ['error', 2, { SwitchCase: 1 }],

      '@stylistic/ts/member-delimiter-style': ['error', {
        multiline: {
          delimiter: 'none',
          requireLast: false,
        },
        singleline: {
          delimiter: 'comma',
          requireLast: false,
        },
      }],

      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-array-constructor': 'error',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@stylistic/js/no-extra-semi': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-implied-eval': 'off',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-parameter-properties': 'off',

      '@typescript-eslint/no-shadow': ['error', { hoist: 'all' }],

      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',

      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-function-type': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/prefer-regexp-exec': 'off',

      '@stylistic/js/quotes': ['error', 'single', { avoidEscape: true }],

      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@stylistic/js/semi': ['error', 'never'],

      '@typescript-eslint/triple-slash-reference': ['error', { lib: 'always', path: 'always', types: 'prefer-import' }],

      '@typescript-eslint/unbound-method': 'error',
      '@typescript-eslint/unified-signatures': 'error',
      'arrow-body-style': 'error',
      'arrow-parens': ['error', 'as-needed'],

      'brace-style': ['error', 'stroustrup', { allowSingleLine: true }],

      'comma-dangle': ['error', {
        arrays: 'always-multiline',
        functions: 'never',
        objects: 'always-multiline',
      }],

      complexity: 'off',
      'constructor-super': 'error',
      curly: ['error', 'multi-line'],
      'eol-last': 'error',
      eqeqeq: ['error', 'smart'],
      'guard-for-in': 'error',

      'id-blacklist': [
        'error',
        'any',
        'Number',
        'number',
        'String',
        'string',
        'Boolean',
        'boolean',
        'Undefined',
        'undefined',
      ],

      'id-match': 'error',
      'import/order': 'off',
      'linebreak-style': ['error', 'unix'],
      'max-classes-per-file': 'off',

      'max-len': ['warn', { code: 240 }],

      'new-parens': 'off',
      'no-array-constructor': 'off',
      'no-bitwise': 'error',
      'no-caller': 'error',
      'no-cond-assign': 'off',
      'no-console': 'error',
      'no-control-regex': 'off',
      'no-debugger': 'error',

      'no-empty': ['error', { allowEmptyCatch: true }],

      'no-empty-function': 'off',
      'no-eval': 'error',
      'no-extra-semi': 'error',
      'no-fallthrough': 'off',
      'no-implied-eval': 'off',
      'no-invalid-this': 'off',
      'no-irregular-whitespace': 'error',

      'no-new-func': 'off',
      'no-new-wrappers': 'error',
      'no-redeclare': 'error',
      'no-throw-literal': 'error',
      'no-trailing-spaces': 'error',
      'no-undef-init': 'error',

      'no-underscore-dangle': ['error', { allowAfterThis: true }],

      'no-unsafe-finally': 'error',
      'no-unused-labels': 'error',
      'no-unused-vars': 'off',
      'no-var': 'error',
      'object-shorthand': 'error',
      'one-var': ['off', 'never'],

      'prefer-const': ['error', { destructuring: 'all' }],

      'prefer-object-spread': 'error',
      'prefer-template': 'error',
      'quote-props': ['error', 'as-needed'],
      radix: 'off',
      'require-await': 'off',

      'space-before-function-paren': ['error', {
        anonymous: 'never',
        asyncArrow: 'always',
        named: 'never',
      }],

      'spaced-comment': ['error', 'always', {
        markers: ['/'],
      }],

      'use-isnan': 'error',
      'valid-typeof': 'off',
      yoda: 'error',
    },
  },
]
