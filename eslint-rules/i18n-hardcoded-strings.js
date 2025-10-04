/**
 * ESLint custom rule to detect hardcoded strings that should be internationalized
 * Usage: Add to .eslintrc.js plugins and rules
 */

module.exports = {
  'no-hardcoded-strings': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Detect hardcoded strings that should be internationalized',
        category: 'Best Practices',
        recommended: true
      },
      schema: [
        {
          type: 'object',
          properties: {
            patterns: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  regex: { type: 'string' },
                  message: { type: 'string' }
                },
                required: ['regex']
              }
            },
            ignore: {
              type: 'array',
              items: { type: 'string' }
            },
            allowedContexts: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      ],
      messages: {
        hardcodedString: '{{message}} Found: "{{text}}"',
        defaultMessage: 'Hardcoded string detected: "{{text}}". Consider using i18n.'
      }
    },

    create(context) {
      const options = context.options[0] || {};
      const patterns = options.patterns || [{ regex: '[Α-Ωα-ωάέήίόύώΐΰ]' }];
      const ignorePatterns = options.ignore || [];
      const allowedContexts = options.allowedContexts || ['test', 'spec', 'story'];

      // Check if file should be ignored
      function shouldIgnoreFile(filename) {
        return ignorePatterns.some(pattern => {
          const regex = new RegExp(pattern.replace('*', '.*'));
          return regex.test(filename);
        });
      }

      // Check if we're in a test/spec/story context
      function isInAllowedContext(filename) {
        return allowedContexts.some(context => filename.includes(context));
      }

      // Check if string matches any hardcoded pattern
      function matchesPattern(text) {
        return patterns.some(pattern => {
          const regex = new RegExp(pattern.regex);
          return regex.test(text);
        });
      }

      // Check if string is already using translation
      function isUsingTranslation(node) {
        // Check if it's inside a t() call
        let parent = node.parent;
        while (parent) {
          if (
            parent.type === 'CallExpression' &&
            parent.callee &&
            parent.callee.name === 't'
          ) {
            return true;
          }
          parent = parent.parent;
        }
        return false;
      }

      // Check if we're in an import statement
      function isInImport(node) {
        let parent = node.parent;
        while (parent) {
          if (parent.type === 'ImportDeclaration') {
            return true;
          }
          parent = parent.parent;
        }
        return false;
      }

      // Check if string is a technical identifier
      function isTechnicalString(text) {
        const technicalPatterns = [
          /^[a-zA-Z0-9_-]+$/, // Simple identifiers
          /^\d+$/, // Numbers only
          /^https?:\/\//, // URLs
          /^\/[a-zA-Z0-9\/_-]*$/, // Paths
          /^[A-Z_]+$/, // Constants
          /\.(js|jsx|ts|tsx|css|scss|json|png|jpg|svg)$/ // File extensions
        ];

        return technicalPatterns.some(pattern => pattern.test(text));
      }

      function checkStringLiteral(node) {
        const filename = context.getFilename();
        
        // Skip if file should be ignored
        if (shouldIgnoreFile(filename) || isInAllowedContext(filename)) {
          return;
        }

        // Skip if already using translation
        if (isUsingTranslation(node)) {
          return;
        }

        // Skip if in import statement
        if (isInImport(node)) {
          return;
        }

        const text = node.value;
        
        // Skip if not a string or empty
        if (typeof text !== 'string' || !text.trim()) {
          return;
        }

        // Skip technical strings
        if (isTechnicalString(text)) {
          return;
        }

        // Check if matches hardcoded pattern
        if (matchesPattern(text)) {
          const matchingPattern = patterns.find(pattern => 
            new RegExp(pattern.regex).test(text)
          );

          context.report({
            node,
            messageId: matchingPattern.message ? 'hardcodedString' : 'defaultMessage',
            data: {
              text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
              message: matchingPattern.message || ''
            }
          });
        }
      }

      return {
        Literal: checkStringLiteral,
        TemplateLiteral(node) {
          // Check template literal content
          node.quasis.forEach(quasi => {
            if (quasi.value && quasi.value.raw) {
              // Create a pseudo-node for the quasi
              const pseudoNode = {
                ...quasi,
                value: quasi.value.raw,
                parent: node.parent
              };
              checkStringLiteral(pseudoNode);
            }
          });
        },
        JSXText: checkStringLiteral
      };
    }
  }
};