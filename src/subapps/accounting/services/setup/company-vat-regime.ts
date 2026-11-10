/**
 * @fileoverview **Καθεστώς ΦΠΑ της επιχείρησης — ο ΕΝΑΣ κριτής** (ADR-ACC-003 §22.4).
 * @module subapps/accounting/services/setup/company-vat-regime
 *
 * 🔑 Πρότυπο Xero «default tax rate» / NetSuite «default tax code» του οργανισμού: η απαλλαγή **δηλώνεται μία
 * φορά στο προφίλ** (`vatRegime` + `vatExemptionCategory`) και η **νέα** γραμμή τιμολογίου ξεκινά από αυτήν·
 * η γραμμή μένει ελεύθερη να αλλάξει, και η υπηρεσία (`ServicePreset`, §22.3) υπερισχύει.
 *
 * 🔑 Εδώ ζουν: η είσοδος του `PUT /api/accounting/setup` (`parseCompanyVatRegime`), η μετάβαση της φόρμας
 * (`withVatRegime`) και η **μία** μετάφραση «καθεστώς → προεπιλογή γραμμής» (`companyLineVatDefault`).
 * Ο κανόνας αντίφασης **δεν** ξαναγράφεται: είναι ο `hasVatExemptionContradiction` των γραμμών και των presets,
 * εφαρμοσμένος στην προεπιλογή που παράγει το προφίλ.
 *
 * ⚠️ **Καμία μαντεψιά κωδικού**: «απαλλασσόμενη» δεν σημαίνει αυτόματα «μικρή επιχείρηση» (κωδ. 15, άρθρα 44–44ζ
 * ν. 5144/2024 μετά την 1/1/2025 — Οδηγός ΑΑΔΕ 29/01/2026)· μπορεί να είναι απαλλασσόμενη δραστηριότητα
 * (κωδ. 7, άρθρο 27). Απαλλασσόμενη χωρίς δηλωμένο κωδικό ⇒ γραμμή 0% **χωρίς** αιτία, που τη μπλοκάρει ο
 * preflight — ποτέ σιωπηλή συμπλήρωση.
 *
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

import { GREEK_EXEMPT_VAT_RATE, GREEK_STANDARD_VAT_RATE } from '../config/vat-rates';
import { isVatExemptionCode, type VatExemptionCode } from '../config/vat-exemption-reasons';
import { hasVatExemptionContradiction } from '../mydata/mydata-codes';
import { COMPANY_VAT_REGIMES, type CompanyVatRegime } from '../../types/company';

/** Ό,τι του προφίλ ορίζει το καθεστώς ΦΠΑ. */
export interface CompanyVatRegimeFields {
  readonly vatRegime: CompanyVatRegime;
  readonly vatExemptionCategory?: number | null;
}

/** Η αφετηρία ΦΠΑ μιας νέας γραμμής τιμολογίου (σχήμα `VatBearing`). */
export interface CompanyLineVatDefault {
  readonly vatRate: number;
  readonly vatExemptionCategory: VatExemptionCode | null;
}

export function isCompanyVatRegime(value: unknown): value is CompanyVatRegime {
  return COMPANY_VAT_REGIMES.some((regime) => regime === value);
}

/**
 * **Η μία μετάφραση** καθεστώς → προεπιλογή γραμμής. Χωρίς προφίλ ή κανονικό ⇒ κανονικός συντελεστής.
 * Απαλλασσόμενη ⇒ 0% + ο δηλωμένος κωδικός (ή `null` όσο δεν δηλώθηκε).
 */
export function companyLineVatDefault(profile: CompanyVatRegimeFields | null): CompanyLineVatDefault {
  if (profile?.vatRegime !== 'exempt') return { vatRate: GREEK_STANDARD_VAT_RATE, vatExemptionCategory: null };
  const code = profile.vatExemptionCategory;
  return { vatRate: GREEK_EXEMPT_VAT_RATE, vatExemptionCategory: isVatExemptionCode(code) ? code : null };
}

/** Μετάβαση της φόρμας: εκτός «απαλλασσόμενη» η αιτία γίνεται `null` (ίδια λογική με το `withVatRate`). */
export function withVatRegime<T extends CompanyVatRegimeFields>(input: T, vatRegime: CompanyVatRegime): T {
  return vatRegime === 'exempt' ? { ...input, vatRegime } : { ...input, vatRegime, vatExemptionCategory: null };
}

export type CompanyVatRegimeParse =
  | { readonly kind: 'value'; readonly vatRegime: CompanyVatRegime; readonly vatExemptionCategory: VatExemptionCode | null }
  | { readonly kind: 'invalid'; readonly reason: string };

/**
 * Αυστηρή ανάλυση εισόδου του `PUT`: απουσία ⇒ κανονικό / `null` (όπως πριν)· άγνωστο καθεστώς, κωδικός εκτός
 * §8.3 ή κωδικός σε κανονικό καθεστώς ⇒ `invalid` (400) — ποτέ σιωπηλή διόρθωση.
 */
export function parseCompanyVatRegime(raw: { readonly vatRegime?: unknown; readonly vatExemptionCategory?: unknown }): CompanyVatRegimeParse {
  const vatRegime = raw.vatRegime ?? 'normal';
  if (!isCompanyVatRegime(vatRegime)) return { kind: 'invalid', reason: 'vatRegime must be normal | exempt' };
  const code = raw.vatExemptionCategory ?? null;
  if (code !== null && !isVatExemptionCode(code)) {
    return { kind: 'invalid', reason: 'vatExemptionCategory is not an AADE §8.3 code (VAT_EXEMPTION_REASONS)' };
  }
  // Ο ΙΔΙΟΣ κανόνας με γραμμές και presets, πάνω στην προεπιλογή που θα παρήγαγε το προφίλ (κωδικός ήδη έγκυρος).
  const lineDefault = { ...companyLineVatDefault({ vatRegime }), vatExemptionCategory: code };
  if (hasVatExemptionContradiction(lineDefault)) {
    return { kind: 'invalid', reason: 'vatExemptionCategory is allowed only when vatRegime is exempt' };
  }
  return { kind: 'value', vatRegime, vatExemptionCategory: code };
}
