module.exports = {
  extends: [
    'next/core-web-vitals',
    '@next/eslint-config-next'
  ],
  plugins: ['i18n-hardcoded-strings'],
  rules: {
    // Custom rule to detect hardcoded Greek strings
    'i18n-hardcoded-strings/no-hardcoded-strings': [
      'warn',
      {
        patterns: [
          {
            regex: '[Α-Ωα-ωάέήίόύώΐΰ]',
            message: 'Hardcoded Greek text found. Consider using t() from useTranslation hook.'
          }
        ],
        ignore: [
          'node_modules/**',
          '**/*.test.*',
          '**/*.spec.*',
          '**/*.stories.*'
        ]
      }
    ],
    
    // Enforce translation hook usage
    'react-hooks/exhaustive-deps': 'warn',
    
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    
    // i18n best practices
    'prefer-template': 'warn', // Encourage template literals for better i18n
  },
  
  overrides: [
    {
      files: ['src/i18n/**/*.ts', 'src/i18n/**/*.js'],
      rules: {
        // Allow hardcoded strings in i18n configuration files
        'i18n-hardcoded-strings/no-hardcoded-strings': 'off'
      }
    },
    {
      files: ['scripts/**/*.js'],
      rules: {
        // Allow hardcoded strings in build scripts
        'i18n-hardcoded-strings/no-hardcoded-strings': 'off'
      }
    }
  ]
};