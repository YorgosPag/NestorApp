/**
 * @fileoverview Μητρώο λήξεων — το ΣΥΜΒΟΛΑΙΟ της ανάγνωσης διακομιστή (ADR-915 Φ4β): όρια και σχήμα απόκρισης.
 * @module services/document-registry/document-registry.types
 *
 * ⚠️ **ΤΑ ΟΡΙΑ ΛΕΓΟΝΤΑΙ, ΔΕΝ ΚΡΥΒΟΝΤΑΙ** (ιδίωμα `MANDATE_CATALOG_CAP`): ένας σιωπηλός αποκεφαλισμός θα διάβαζε «αυτά
 * είναι όλα» ενώ θα ήταν «όσα χώρεσαν» — και σε μητρώο λήξεων αυτό σημαίνει «τίποτα δεν λήγει» για εταιρεία που έχει.
 * Κάθε πηγή που χτύπησε το όριό της **ονομάζεται** στο `truncatedSources`.
 */

import type { DocumentRegistry } from '@/lib/document-validity/document-registry';

/** Οι πηγές που διαβάζονται με ερώτημα — άρα έχουν όριο. */
export const REGISTRY_SOURCES = ['files', 'declared', 'cases'] as const;
export type RegistrySource = (typeof REGISTRY_SOURCES)[number];

/** Βαλβίδα ασφαλείας ανά πηγή, όχι σελιδοποίηση. Η υπόθεση = ίδιο μέγεθος με τη σάρωση λήξεων (`EXPIRY_SWEEP_LIMIT`). */
export const DOCUMENT_REGISTRY_CAPS: Readonly<Record<RegistrySource, number>> = {
  files: 500,
  declared: 500,
  cases: 200,
};

/** Μέγεθος ομάδας `getAll` — δεν βρέθηκε τεκμηριωμένο όριο· αμυντικό (ADR-915 §11.3). */
export const REGISTRY_GET_ALL_CHUNK = 100;

/** Ό,τι χρειάζεται η οθόνη για να **ονομάσει** μια γραμμή ή το «τι σταματά» της — ποτέ ταυτότητα ανθρώπου. */
export interface RegistryLabel {
  readonly name: string | null;
}

export interface DocumentRegistryResponse extends DocumentRegistry {
  /** Η μία «σήμερα» (Ελλάδα) όλων των γραμμών. */
  readonly asOf: string;
  /** ISO — πότε αλλάζει η «σήμερα»: οι καταστάσεις αλλάζουν **μόνες τους** εκεί, και η οθόνη ξαναρωτά (ADR-901 §14.8). */
  readonly freshUntil: string;
  /** `true` όταν **κάποια** πηγή χτύπησε το όριο. **Ποτέ σιωπηλό.** */
  readonly truncated: boolean;
  readonly truncatedSources: readonly RegistrySource[];
  /** Ονόματα ακινήτων (γραμμή · υπόθεση · αγγελία δένονται όλα σε ακίνητο). */
  readonly properties: Readonly<Record<string, RegistryLabel>>;
  /** Ονόματα αρχείων (`displayName`). */
  readonly files: Readonly<Record<string, RegistryLabel>>;
}
