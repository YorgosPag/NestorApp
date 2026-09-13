/**
 * @fileoverview Accounting Subapp — Hooks Barrel Export
 * @description Public API για όλα τα client-side hooks του λογιστικού υποσυστήματος
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 */

// ── Company Setup Hooks ──────────────────────────────────────────────────────
export { useCompanySetup } from './useCompanySetup';

// ── Invoice Hooks ────────────────────────────────────────────────────────────
// ⚠️ Το `useInvoices` (πληθυντικός) **διαγράφηκε** 2026-09-14 (ADR-787 Φάση Β, Β2):
//    ήταν αχρησιμοποίητο και **λάθος** — διάβαζε `data.invoices`, ενώ η διαδρομή
//    απαντά `{ success, data: { items } }`, και το `createInvoice` του διάβαζε
//    `id` ενώ η διαδρομή στέλνει `invoiceId`. Η ζωντανή οθόνη
//    (`InvoicesPageContent.tsx`) διάβαζε **σωστά**, με δικό της κώδικα.
//    ⛔ ΜΗΝ το αναστήσεις για να «κεντρικοποιήσεις» τη ζωντανή οθόνη: αφαίρεση με
//    **έναν** καλούντα είναι speculative generality (Rule of Three). Αν εμφανιστεί
//    δεύτερος, εξάγεται από τον **ζωντανό σωστό** κώδικα — όχι από το νεκρό λάθος.
export { useInvoice } from './useInvoice';

// ── Journal Entry Hooks ──────────────────────────────────────────────────────
export { useJournalEntries } from './useJournalEntries';

// ── VAT Hooks ────────────────────────────────────────────────────────────────
export { useVATSummary } from './useVATSummary';

// ── Tax Hooks ────────────────────────────────────────────────────────────────
export { useTaxEstimate } from './useTaxEstimate';

// ── Bank Reconciliation Hooks ────────────────────────────────────────────────
export { useBankTransactions } from './useBankTransactions';

// ── Fixed Assets Hooks ───────────────────────────────────────────────────────
export { useFixedAssets } from './useFixedAssets';

// ── EFKA Hooks ───────────────────────────────────────────────────────────────
export { useEFKASummary } from './useEFKASummary';

// ── Document Hooks ───────────────────────────────────────────────────────────
export { useExpenseDocuments } from './useExpenseDocuments';
export { useExpenseDocument } from './useExpenseDocument';

// ── Service Presets Hooks (ADR-ACC-011) ──────────────────────────────────────
export { useServicePresets } from './useServicePresets';

// ── APY Certificate Hooks (ADR-ACC-020) ──────────────────────────────────────
export { useAPYCertificates } from './useAPYCertificates';

// ── Custom Category Hooks (ADR-ACC-021) ───────────────────────────────────────
export { useCustomCategories } from './useCustomCategories';

// ── Financial Reports Hooks (Phase 2e — Reports Dashboard) ──────────────────
export { useReport } from './useReport';
export { useReportsDashboard } from './useReportsDashboard';
