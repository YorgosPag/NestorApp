/**
 * =============================================================================
 * ENTERPRISE ESLINT RULE: no-console-log
 * =============================================================================
 *
 * @enterprise SAP/Salesforce/Microsoft Pattern - Structured Logging
 *
 * RULE: Απαγορεύει τη χρήση console.log/warn/info/debug
 * ΛΥΣΗ: Χρήση του centralized Logger από @/lib/telemetry
 *
 * WHY:
 * - Console.log δεν έχει log levels
 * - Console.log δεν μπορεί να απενεργοποιηθεί εύκολα σε production
 * - Console.log δεν έχει structured metadata
 * - Console.log δημιουργεί θόρυβο στην κονσόλα
 *
 * ENTERPRISE STANDARD:
 * - SAP: Uses SAP Cloud Logging Service
 * - Microsoft: Uses ILogger with log levels
 * - Google: Uses Cloud Logging with structured logs
 *
 * @see src/lib/telemetry/Logger.ts - Canonical Logger implementation
 */

const CONSOLE_METHODS = ['log', 'warn', 'info', 'debug'];

const REPLACEMENT_MAP = {
  log: 'logger.debug() or logger.info()',
  warn: 'logger.warn()',
  info: 'logger.info()',
  debug: 'logger.debug()',
};

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow console.log/warn/info/debug - use Logger from @/lib/telemetry instead',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null, // Cannot auto-fix (requires import and context changes)
    schema: [
      {
        type: 'object',
        properties: {
          allowError: {
            type: 'boolean',
            default: true,
            description: 'Allow console.error (for critical unhandled errors)',
          },
          allowInTests: {
            type: 'boolean',
            default: true,
            description: 'Allow console in test files',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noConsole:
        '🚫 [ENTERPRISE] Avoid console.{{ method }}(). Use Logger from @/lib/telemetry instead.\n' +
        '   Replace with: {{ replacement }}\n' +
        '   Example: import { createModuleLogger } from "@/lib/telemetry";\n' +
        '            const logger = createModuleLogger("{{ moduleName }}");\n' +
        '            {{ replacement }}("message", { metadata });',
      noConsoleSimple:
        '🚫 [ENTERPRISE] Avoid console.{{ method }}(). Use Logger from @/lib/telemetry instead.',
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const allowError = options.allowError !== false; // Default true
    const allowInTests = options.allowInTests !== false; // Default true

    // Get filename to determine module name
    const filename = context.getFilename();

    // Check if test file
    const isTestFile = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filename);
    if (isTestFile && allowInTests) {
      return {}; // Skip test files
    }

    // Extract module name from path
    const getModuleName = () => {
      const parts = filename.split(/[/\\]/);
      // Try to find a meaningful name from path
      const srcIndex = parts.indexOf('src');
      if (srcIndex >= 0 && srcIndex < parts.length - 1) {
        // Get the component/service name
        const relevantParts = parts.slice(srcIndex + 1);
        const lastName = relevantParts[relevantParts.length - 1];
        // Remove extension
        const name = lastName.replace(/\.(ts|tsx|js|jsx)$/, '');
        // Convert to SCREAMING_SNAKE_CASE
        return name
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .replace(/[-\s]/g, '_')
          .toUpperCase();
      }
      return 'MODULE';
    };

    return {
      CallExpression(node) {
        // Check if it's a console.method() call
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'console' &&
          node.callee.property.type === 'Identifier'
        ) {
          const method = node.callee.property.name;

          // Allow console.error if option is set
          if (method === 'error' && allowError) {
            return;
          }

          // Check if it's a method we care about
          if (CONSOLE_METHODS.includes(method)) {
            const moduleName = getModuleName();
            const replacement = REPLACEMENT_MAP[method] || 'logger.info()';

            context.report({
              node,
              messageId: 'noConsole',
              data: {
                method,
                replacement,
                moduleName,
              },
            });
          }
        }
      },
    };
  },
};
