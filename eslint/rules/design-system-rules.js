// ESLint Custom Rules for Design System Compliance
// Prevents hardcoded values and enforces design token usage
// 🏢 ENTERPRISE: ADR-023 - Centralized Component Imports

module.exports = {
  // ==========================================================================
  // 🔄 NO-DIRECT-LOADER-IMPORT - Enforce Spinner usage (ADR-023)
  // ==========================================================================
  'no-direct-loader-import': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Disallow direct Loader2 import from lucide-react. Use centralized Spinner component.',
        category: 'Design System',
        recommended: true,
      },
      messages: {
        useSpinner: 'Direct import of Loader2 from lucide-react is not allowed. Use the centralized Spinner component instead: import { Spinner } from "@/components/ui/spinner"',
      }
    },
    create(context) {
      return {
        ImportDeclaration(node) {
          // Check if importing from lucide-react
          if (node.source.value === 'lucide-react') {
            // Check if Loader2 is being imported
            const hasLoader2 = node.specifiers.some(spec =>
              spec.type === 'ImportSpecifier' &&
              spec.imported &&
              spec.imported.name === 'Loader2'
            );

            if (hasLoader2) {
              // Allow only in the Spinner component itself
              const filename = context.getFilename();
              const isSpinnerComponent = filename.includes('components/ui/spinner');
              const isModalLoadingStates = filename.includes('ModalLoadingStates');
              const isLoadingTsx = filename.endsWith('loading.tsx');

              // Allow in canonical locations
              if (isSpinnerComponent || isModalLoadingStates || isLoadingTsx) {
                return;
              }

              context.report({
                node,
                messageId: 'useSpinner',
              });
            }
          }
        }
      };
    }
  },


  'no-hardcoded-colors': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Disallow hardcoded color values in favor of design tokens',
        category: 'Design System',
        recommended: true,
      },
      fixable: 'code',
      schema: [
        {
          type: 'object',
          properties: {
            allowedPatterns: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          additionalProperties: false
        }
      ],
      messages: {
        hardcodedColor: 'Hardcoded color "{{value}}" detected. Use design tokens or semantic colors instead.',
        suggestion: 'Consider using: {{suggestion}}'
      }
    },
    create(context) {
      const options = context.options[0] || {};
      const allowedPatterns = options.allowedPatterns || [];
      
      // Patterns to detect hardcoded colors
      const hardcodedColorPatterns = [
        /#[0-9A-Fa-f]{6}/,  // #ffffff
        /#[0-9A-Fa-f]{3}/,   // #fff
        /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/,  // rgb(255, 255, 255)
        /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)/,  // rgba(255, 255, 255, 0.5)
        /hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)/,  // hsl(0, 0%, 100%)
        /hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)/  // hsla(0, 0%, 100%, 0.5)
      ];
      
      const suggestions = {
        '#ffffff': 'hsl(var(--background)) or bg-background',
        '#000000': 'hsl(var(--foreground)) or text-foreground',
        'rgb(255, 0, 0)': 'hsl(var(--status-error)) or getStatusColor("error", "bg")',
        'rgb(0, 255, 0)': 'hsl(var(--status-success)) or getStatusColor("success", "bg")',
        'rgb(0, 0, 255)': 'hsl(var(--status-info)) or getStatusColor("info", "bg")'
      };
      
      function checkForHardcodedColors(node, value) {
        if (typeof value !== 'string') return;
        
        // Skip if value matches allowed patterns
        if (allowedPatterns.some(pattern => new RegExp(pattern).test(value))) {
          return;
        }
        
        // Check against hardcoded color patterns
        for (const pattern of hardcodedColorPatterns) {
          if (pattern.test(value)) {
            const suggestion = suggestions[value] || 'a design token or semantic color';
            
            context.report({
              node,
              messageId: 'hardcodedColor',
              data: {
                value,
                suggestion
              }
            });
            break;
          }
        }
      }
      
      return {
        // Check string literals
        Literal(node) {
          if (typeof node.value === 'string') {
            checkForHardcodedColors(node, node.value);
          }
        },
        
        // Check template literals
        TemplateLiteral(node) {
          node.quasis.forEach(quasi => {
            checkForHardcodedColors(node, quasi.value.raw);
          });
        },
        
        // Check object properties (for style objects)
        Property(node) {
          if (node.key && node.value && node.value.type === 'Literal') {
            const keyName = node.key.name || node.key.value;
            const colorProperties = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'];
            
            if (colorProperties.includes(keyName)) {
              checkForHardcodedColors(node.value, node.value.value);
            }
          }
        }
      };
    }
  },

  'no-hardcoded-spacing': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Disallow hardcoded spacing values in favor of design tokens',
        category: 'Design System',
        recommended: true,
      },
      messages: {
        hardcodedSpacing: 'Hardcoded spacing "{{value}}" detected. Use design tokens like getSpacingClass() or Tailwind classes.',
      }
    },
    create(context) {
      const hardcodedSpacingPattern = /\d+(px|rem|em)/;
      const spacingProperties = [
        'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
        'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'gap', 'rowGap', 'columnGap', 'top', 'right', 'bottom', 'left'
      ];
      
      function checkForHardcodedSpacing(node, value) {
        if (typeof value === 'string' && hardcodedSpacingPattern.test(value)) {
          context.report({
            node,
            messageId: 'hardcodedSpacing',
            data: { value }
          });
        }
      }
      
      return {
        Property(node) {
          if (node.key && node.value && node.value.type === 'Literal') {
            const keyName = node.key.name || node.key.value;
            
            if (spacingProperties.includes(keyName)) {
              checkForHardcodedSpacing(node.value, node.value.value);
            }
          }
        }
      };
    }
  },

  'prefer-design-system-imports': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Encourage usage of design system utilities',
        category: 'Design System',
        recommended: true,
      },
      messages: {
        missingDesignSystemImport: 'Consider importing design system utilities for consistent styling: {{suggestion}}',
      }
    },
    create(context) {
      let hasDesignSystemImport = false;
      let hasClassNameUsage = false;
      let hasStyleUsage = false;
      
      return {
        ImportDeclaration(node) {
          if (node.source.value === '@/lib/design-system' || 
              node.source.value === '@/styles/design-tokens') {
            hasDesignSystemImport = true;
          }
        },
        
        JSXAttribute(node) {
          if (node.name.name === 'className') {
            hasClassNameUsage = true;
          }
          if (node.name.name === 'style') {
            hasStyleUsage = true;
          }
        },
        
        'Program:exit'(node) {
          if ((hasClassNameUsage || hasStyleUsage) && !hasDesignSystemImport) {
            context.report({
              node,
              messageId: 'missingDesignSystemImport',
              data: {
                suggestion: "import { getStatusColor, getSpacingClass } from '@/lib/design-system'"
              }
            });
          }
        }
      };
    }
  },

  'enforce-semantic-colors': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Enforce usage of semantic color functions over hardcoded Tailwind color classes',
        category: 'Design System',
        recommended: true,
      },
      messages: {
        useSemanticColor: 'Use semantic color function instead of hardcoded color class: {{suggestion}}',
      }
    },
    create(context) {
      const colorClassPattern = /(bg|text|border)-(red|green|blue|yellow|purple|indigo|pink|gray)-(100|200|300|400|500|600|700|800|900)/;
      
      return {
        Literal(node) {
          if (typeof node.value === 'string' && colorClassPattern.test(node.value)) {
            const match = node.value.match(colorClassPattern);
            if (match) {
              const [, prefix, color, shade] = match;
              let suggestion = '';
              
              if (color === 'red') {
                suggestion = `getStatusColor('error', '${prefix}')`;
              } else if (color === 'green') {
                suggestion = `getStatusColor('success', '${prefix}')`;
              } else if (color === 'blue') {
                suggestion = `getStatusColor('info', '${prefix}')`;
              } else if (color === 'yellow') {
                suggestion = `getStatusColor('warning', '${prefix}')`;
              }
              
              if (suggestion) {
                context.report({
                  node,
                  messageId: 'useSemanticColor',
                  data: { suggestion }
                });
              }
            }
          }
        }
      };
    }
  }
};