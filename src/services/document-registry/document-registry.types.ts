/**
 * @fileoverview Μητρώο λήξεων — το ΣΥΜΒΟΛΑΙΟ της ανάγνωσης διακομιστή (ADR-915 Φ4β): όρια και σχήμα απόκρισης.
 * @module services/document-registry/document-registry.types
 *
 * ⚠️ **ΤΑ ΟΡΙΑ ΛΕΓΟΝΤΑΙ, ΔΕΝ ΚΡΥΒΟΝΤΑΙ** (ιδίωμα `MANDATE_CATALOG_CAP`): ένας σιωπηλός αποκεφαλισμός θα διάβαζε «αυτά
 * είναι όλα» ενώ θα ήταν «όσα χώρεσαν» — και σε μητρώο λήξεων αυτό σημαίνει «τίποτα δεν λήγει» για εταιρεία που έχει.
 * Κάθε πηγή που χτύπησε το όριό της **ονομάζεται** στο `truncatedSources`.
 */

import type { DocumentRegistry } from '@/lib/document-validity/document-registry';

/**
 * Οι πηγές που διαβάζονται με ερώτημα — άρα έχουν όριο. Φ4δ: `owner-properties` (ακίνητα ιδιωτών υπό θεματοφυλακή του
 * γραφείου, Ε10) · `listings` (οι αγγελίες με το όνομα του γραφείου — βρίσκονται **και** όταν το ακίνητο δεν έχει
 * κανένα έγγραφο, Ε11).
 */
export const REGISTRY_SOURCES = ['files', 'declared', 'cases', 'owner-properties', 'listings'] as const;
export type RegistrySource = (typeof REGISTRY_SOURCES)[number];

/** Βαλβίδα ασφαλείας ανά πηγή, όχι σελιδοποίηση. Η υπόθεση = ίδιο μέγεθος με τη σάρωση λήξεων (`EXPIRY_SWEEP_LIMIT`). */
export const DOCUMENT_REGISTRY_CAPS: Readonly<Record<RegistrySource, number>> = {
  files: 500,
  declared: 500,
  cases: 200,
  'owner-properties': 500,
  listings: 500,
};

/** Σε ποιο **είδος** ακινήτου δείχνει το όνομα — αποφασίζει τη διεύθυνση της οθόνης (ακίνητο εταιρείας · εντολή). */
export type RegistryPropertyScope = 'property' | 'owner-property';

/** Μέγεθος ομάδας `getAll` — δεν βρέθηκε τεκμηριωμένο όριο· αμυντικό (ADR-915 §11.3). */
export const REGISTRY_GET_ALL_CHUNK = 100;

/** Ό,τι χρειάζεται η οθόνη για να **ονομάσει** μια γραμμή ή το «τι σταματά» της — ποτέ ταυτότητα ανθρώπου. */
export interface RegistryLabel {
  readonly name: string | null;
}

export interface RegistryPropertyLabel extends RegistryLabel {
  readonly scope: RegistryPropertyScope;
  /**
   * Ο **δήμος** του ακινήτου (ταυτότητα ADR-883, `municipality:<κωδ.>`) για το «Βρες επαγγελματία» (ADR-915 §24).
   * Υπολογίζεται **μόνο** για ακίνητα με γραμμή που το δείχνει. `null` = δεν ρωτήθηκε ή δεν αποδεικνύεται — **ποτέ**
   * «πουθενά»: ο κατάλογος ανοίγει τότε χωρίς περιοχή.
   */
  readonly areaId: string | null;
}

export interface DocumentRegistryResponse extends DocumentRegistry {
  /** Η μία «σήμερα» (Ελλάδα) όλων των γραμμών. */
  readonly asOf: string;
  /** ISO — πότε αλλάζει η «σήμερα»: οι καταστάσεις αλλάζουν **μόνες τους** εκεί, και η οθόνη ξαναρωτά (ADR-901 §14.8). */
  readonly freshUntil: string;
  /** `true` όταν **κάποια** πηγή χτύπησε το όριο. **Ποτέ σιωπηλό.** */
  readonly truncated: boolean;
  readonly truncatedSources: readonly RegistrySource[];
  /**
   * Αγγελίες με το όνομα του γραφείου (`agencyId`) που **δεν** αντιστοιχούν σε ακίνητο ή εντολή υπό τη θεματοφυλακή του
   * — δεν ελέγχονται, και **μετριούνται** (Ε11): το όριο έχει αριθμό, όχι γενική φράση.
   */
  readonly unscopedListings: number;
  /** Ονόματα ακινήτων (γραμμή · υπόθεση · αγγελία δένονται όλα σε ακίνητο), με το είδος τους. */
  readonly properties: Readonly<Record<string, RegistryPropertyLabel>>;
  /** Ονόματα αρχείων (`displayName`). */
  readonly files: Readonly<Record<string, RegistryLabel>>;
}
