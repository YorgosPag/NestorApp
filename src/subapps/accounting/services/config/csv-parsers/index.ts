/**
 * @fileoverview CSV Parser Configs — Per-Bank CSV Import Configuration
 * @description Strategy pattern: each bank = 1 parser config
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { CSVParserConfig } from '../../../types/bank';
import { NBG_PARSER_CONFIG } from './nbg';
import { EUROBANK_PARSER_CONFIG } from './eurobank';
import { PIRAEUS_PARSER_CONFIG } from './piraeus';
import { ALPHA_PARSER_CONFIG } from './alpha';

// ============================================================================
// ALL SUPPORTED BANK PARSERS
// ============================================================================

/**
 * Registry υποστηριζόμενων τραπεζικών CSV parsers
 *
 * Κάθε ελληνική τράπεζα εξάγει CSV με διαφορετική δομή.
 * Αυτό το registry ορίζει τον τρόπο parsing ανά τράπεζα.
 */
export const CSV_PARSER_REGISTRY: ReadonlyMap<string, CSVParserConfig> = new Map([
  [NBG_PARSER_CONFIG.bankCode, NBG_PARSER_CONFIG],
  [EUROBANK_PARSER_CONFIG.bankCode, EUROBANK_PARSER_CONFIG],
  [PIRAEUS_PARSER_CONFIG.bankCode, PIRAEUS_PARSER_CONFIG],
  [ALPHA_PARSER_CONFIG.bankCode, ALPHA_PARSER_CONFIG],
]);

/**
 * Λήψη parser config βάσει bank code
 */
export function getParserConfig(bankCode: string): CSVParserConfig | null {
  return CSV_PARSER_REGISTRY.get(bankCode) ?? null;
}

/**
 * Λίστα υποστηριζόμενων τραπεζών
 */
export function getSupportedBanks(): CSVParserConfig[] {
  return Array.from(CSV_PARSER_REGISTRY.values());
}

// Re-export individual parsers
export { NBG_PARSER_CONFIG } from './nbg';
export { EUROBANK_PARSER_CONFIG } from './eurobank';
export { PIRAEUS_PARSER_CONFIG } from './piraeus';
export { ALPHA_PARSER_CONFIG } from './alpha';
