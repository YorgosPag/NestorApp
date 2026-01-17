/**
 * =============================================================================
 * SHARED UTILITY: Load .env.local
 * =============================================================================
 *
 * Enterprise-grade environment loader for scripts.
 * Single source of truth for env loading across all scripts.
 *
 * @module scripts/_shared/loadEnvLocal
 * @enterprise Zero Duplicates - Shared Utilities
 */

const fs = require('fs');
const path = require('path');

/**
 * Load environment variables from .env.local
 * @returns {Record<string, string>} Environment variables
 */
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '..', '.env.local');

  if (!fs.existsSync(envPath)) {
    console.warn('[ENV] .env.local not found at:', envPath);
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    // Skip empty lines and comments
    if (!line.trim() || line.startsWith('#')) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      envVars[key] = value;
    }
  });

  console.log(`[ENV] Loaded ${Object.keys(envVars).length} variables from .env.local`);
  return envVars;
}

module.exports = { loadEnvLocal };
