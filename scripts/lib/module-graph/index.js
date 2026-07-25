#!/usr/bin/env node
/**
 * ADR-700 §1 — barrel-aware module graph (SSoT re-export surface).
 */

'use strict';

module.exports = {
  ...require('./resolve-specifier'),
  ...require('./parse-module'),
  ...require('./build-graph'),
  ...require('./classify-exports'),
};
