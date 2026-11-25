import tseslint from 'typescript-eslint'
export default [
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'backend/**/*.mjs'],
    languageOptions: { parser: tseslint.parser },
    rules: {
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unsafe-finally': 'error',
    },
  },
]
