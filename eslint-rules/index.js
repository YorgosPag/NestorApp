module.exports = {
  rules: {
    'no-hardcoded-strings': require('./no-hardcoded-strings'),
    // 🏢 ENTERPRISE: SAP/Microsoft/Google Pattern - Structured Logging
    'no-console-log': require('./no-console-log'),
    // 🏢 CLAUDE.md SOS. N.11 — block hardcoded defaultValue in i18n calls
    'no-i18n-defaultvalue-literals': require('./no-i18n-defaultvalue-literals'),
  },
};