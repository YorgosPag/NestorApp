module.exports = {
  rules: {
    'no-hardcoded-strings': require('./no-hardcoded-strings'),
    // 🏢 ENTERPRISE: SAP/Microsoft/Google Pattern - Structured Logging
    'no-console-log': require('./no-console-log'),
  },
};