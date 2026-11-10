/**
 * @fileoverview **Συντελεστής ΦΠΑ και αιτία εξαίρεσης — ΜΙΑ μετάβαση** (ADR-ACC-003 §7 · §22.1 · §22.3).
 * @module subapps/accounting/components/shared/vat-rate-transition
 *
 * 🔑 Η αιτία εξαίρεσης έχει νόημα **μόνο** στην κατηγορία «Άνευ ΦΠΑ» (0%). Όταν ο συντελεστής φεύγει από εκεί
 * — από τον επιλογέα γραμμής, από έτοιμη υπηρεσία (`ServicePreset`) ή στη φόρμα της ίδιας της υπηρεσίας — η αιτία
 * **καθαρίζει**: αλλιώς μένει αποθηκευμένος κωδικός που λέει «απαλλαγή» σε γραμμή με 24%, και ο διακομιστής τον
 * απορρίπτει (`hasVatExemptionContradiction`).
 *
 * Γενικές συναρτήσεις: ό,τι φέρει `vatRate` + `vatExemptionCategory` (γραμμή τιμολογίου, preset, κατάσταση φόρμας)
 * περνά από τον **ίδιο** κανόνα. Καθαρές — καμία μετάλλαξη του ορίσματος.
 */

import type { VatExemptionCode } from '@/subapps/accounting/services/config/vat-exemption-reasons';
import { requiresVatExemption } from '@/subapps/accounting/services/mydata/mydata-codes';

/** Ό,τι κουβαλά συντελεστή ΦΠΑ και (προαιρετικά) αιτία εξαίρεσης. */
export interface VatBearing {
  readonly vatRate: number;
  readonly vatExemptionCategory?: number | null;
}

/** Νέος συντελεστής· εκτός «Άνευ ΦΠΑ» η αιτία γίνεται `null`. Στο 0% η υπάρχουσα αιτία **μένει**. */
export function withVatRate<T extends VatBearing>(item: T, vatRate: number): T {
  return requiresVatExemption(vatRate)
    ? { ...item, vatRate }
    : { ...item, vatRate, vatExemptionCategory: null };
}

/** Αιτία εξαίρεσης — μόνο αν ο συντελεστής τη δέχεται· αλλιώς το αντικείμενο μένει ως έχει. */
export function withVatExemption<T extends VatBearing>(item: T, code: VatExemptionCode): T {
  return requiresVatExemption(item.vatRate) ? { ...item, vatExemptionCategory: code } : item;
}
