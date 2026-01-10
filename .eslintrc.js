module.exports = {
  extends: [
    'next/core-web-vitals',
    '@next/eslint-config-next'
  ],
  plugins: ['i18n-hardcoded-strings'],
  rules: {
    // 🏢 ENTERPRISE: Prevent barrel imports from @/components/generic
    // This architectural guardrail ensures domain-scoped mappings are used
    // Uses 'paths' (not 'patterns') to block ONLY the barrel entrypoint
    // Direct file imports like @/components/generic/UniversalTabsRenderer remain allowed
    'no-restricted-imports': ['error', {
      paths: [{
        name: '@/components/generic',
        message:
          'Do not import from the generic barrel. Use direct imports: ' +
          '@/components/generic/UniversalTabsRenderer or ' +
          '@/components/generic/mappings/<domain>Mappings'
      }]
    }],

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