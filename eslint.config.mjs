// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
// import storybook from "eslint-plugin-storybook"; // Commented out due to missing package

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";
import customRules from "./eslint-rules/index.js";
import designSystemRules from "./eslint/index.js";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], plugins: { js }, extends: ["js/recommended"] },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: {
      "custom": customRules,
      "design-system": designSystemRules,
    },
    rules: {
      // Enable custom hardcoded strings detection
      "custom/no-hardcoded-strings": ["error", {
        allowedPatterns: [
          "^[a-z][a-zA-Z0-9]*$", // camelCase identifiers
          "^[A-Z_][A-Z0-9_]*$",  // CONSTANT_CASE
          "^[0-9\\s\\-\\+\\(\\)]+$", // numbers and basic punctuation
          "^#[0-9a-fA-F]{3,8}$", // hex colors
          "^\\.[a-zA-Z\\-]+$",   // CSS classes
          "^[a-z\\-]+$",         // kebab-case
          "^\\w+\\.[a-zA-Z0-9\\.]+$", // file extensions
        ],
        ignoreAttributes: [
          "className", "id", "key", "testId", "data-testid", "aria-label",
          "href", "src", "alt", "type", "name", "placeholder", "value"
        ]
      }],
      
      // Design System Rules - STRICT MODE ENABLED
      "design-system/no-hardcoded-colors": "error",
      "design-system/no-hardcoded-spacing": "error",  // Upgraded to error
      "design-system/prefer-design-system-imports": "error",  // Upgraded to error
      "design-system/enforce-semantic-colors": "error",  // Upgraded to error
      
      // Additional strict rules for component architecture
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/prefer-const": "error",
      "@typescript-eslint/no-var-requires": "error",
      "react/prop-types": "off", // We use TypeScript for prop validation
      "react/react-in-jsx-scope": "off", // Not needed in Next.js
      "react/display-name": "error",
      "react/jsx-key": "error",
      "react/no-array-index-key": "warn",
      "react/no-unused-state": "error",
      "react/self-closing-comp": "error",
      "react/jsx-boolean-value": ["error", "never"],
      "react/jsx-curly-brace-presence": ["error", { "props": "never", "children": "never" }],
    },
  },
  {
    // Disable rules for specific files
    files: [
      "**/*.config.{js,ts,mjs}",
      "**/tailwind.config.ts",
      "**/next.config.js",
      "**/*.test.{js,ts,tsx}",
      "**/*.spec.{js,ts,tsx}",
      "**/*.d.ts",
      "eslint-rules/**/*",
      "eslint/**/*",
      "src/i18n/**/*",
      "src/utils/**/*", // Allow debug messages in utils
      "src/data/**/*",  // Allow seed data
      "src/styles/**/*", // Allow design tokens file
      "src/lib/validation/**/*", // Allow validation utilities
    ],
    rules: {
      "custom/no-hardcoded-strings": "off",
      "design-system/no-hardcoded-colors": "off",
      "design-system/no-hardcoded-spacing": "off",
      "design-system/prefer-design-system-imports": "off",
      "design-system/enforce-semantic-colors": "off",
      // Disable strict rules for config files
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-var-requires": "off",
      "react/display-name": "off",
    },
  },
]);
