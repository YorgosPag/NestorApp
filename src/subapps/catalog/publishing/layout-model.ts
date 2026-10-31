/**
 * =============================================================================
 * ΤΟ ΟΥΔΕΤΕΡΟ ΜΟΝΤΕΛΟ ΔΙΑΤΑΞΗΣ (ADR-923 §5.6 · §21.4.3) — σελίδα → μπλοκ → πίνακας/κείμενο/εικόνα
 * =============================================================================
 *
 * Τα πρότυπα γράφονται **πάνω από αυτό**, όχι πάνω από τη μηχανή: η μηχανή αλλάζει χωρίς να ξαναγραφτούν. Ό,τι δεν είναι
 * δουλειά μηχανής αποφασίζεται **εδώ**, πριν φτάσει σε αυτήν: ποιες στήλες, δηλωμένες συγχωνεύσεις, rowspan/colspan,
 * συνέχεια σε νέο μπλοκ όταν οι στήλες δεν χωρούν, μορφή `el-GR`, υποδείξεις σπασίματος.
 *
 * 🔒 Είναι **καθαρά δεδομένα** (σειριοποιείται σε JSON). Το κείμενο του προμηθευτή δεν ενώνεται ποτέ σε κώδικα προτύπου:
 *    ο προσαρμογέας το διαβάζει ως δεδομένο, άρα «#import» μέσα σε μια περιγραφή είναι απλώς κείμενο.
 * 🔑 Χρώμα και εικόνα δηλώνονται **ανά προφίλ** ({@link LayoutColour} · {@link LayoutImageRef}): η ίδια σελίδα βγαίνει
 *    CMYK στην εκτύπωση και RGB στην οθόνη χωρίς δεύτερο πρότυπο.
 *
 * @module subapps/catalog/publishing/layout-model
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { PublicationOutputProfile, PublicationTemplate } from './publication-vocabulary';

/** Το ίδιο χρώμα στους δύο χώρους: `rgb` = `#rrggbb` · `cmyk` = ποσοστά 0–100. */
export interface LayoutColour {
  readonly rgb: string;
  readonly cmyk: readonly [number, number, number, number];
}

export interface LayoutTheme {
  readonly fontFamily: string;
  readonly primary: LayoutColour;
  readonly accent: LayoutColour;
  readonly tint: LayoutColour;
  readonly text: LayoutColour;
  readonly rule: LayoutColour;
}

export interface LayoutPage {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly marginMm: number;
  /** Μόνο στο προφίλ εκτύπωσης· στην οθόνη 0. */
  readonly bleedMm: number;
}

/** Τρέχον κείμενο με έμφαση — το υποσύνολο του `richText` που ζει σε σελίδα. */
export interface LayoutInline {
  readonly text: string;
  readonly strong?: boolean;
  readonly emphasis?: boolean;
  readonly link?: string;
}

/** Η εικόνα ως **αναφορά**: ποιο αρχείο μπαίνει το αποφασίζει το προφίλ (print ⇒ CMYK JPEG · screen ⇒ sRGB). */
export interface LayoutImageRef {
  readonly assetId: string;
  readonly alt: string;
  readonly widthMm: number;
}

export type LayoutCellRole = 'corner' | 'columnHead' | 'rowHead' | 'groupBand' | 'groupRail' | 'value' | 'price';

export interface LayoutCell {
  readonly text: string;
  readonly role: LayoutCellRole;
  readonly colSpan: number;
  readonly rowSpan: number;
}

export interface LayoutTableRow {
  readonly id: string;
  /** Γραμμή κεφαλίδας: επαναλαμβάνεται όταν ο πίνακας σπάει σε νέα σελίδα (§21.1). */
  readonly header: boolean;
  readonly cells: readonly LayoutCell[];
}

export interface LayoutTable {
  readonly id: string;
  readonly caption: string;
  /** Πλήθος στηλών **χωρίς** span: στήλη ομάδας (αν υπάρχει) + στήλη ετικέτας + στήλες τιμών. */
  readonly columnCount: number;
  readonly railColumn: boolean;
  /** Τα σταθερά πλάτη: η **μία** αλήθεια για τον υπολογισμό στηλών και για το πρότυπο. Οι στήλες τιμών μοιράζονται το υπόλοιπο. */
  readonly labelColumnMm: number;
  readonly railColumnMm: number;
  /** Η θέση στη συνέχεια όταν οι στήλες δεν χωρούν (`1 από 2`). Μονό μπλοκ ⇒ 1 από 1. */
  readonly part: number;
  readonly parts: number;
  readonly rows: readonly LayoutTableRow[];
}

export interface LayoutGridCard {
  readonly id: string;
  readonly title: string;
  readonly code: string | null;
  readonly image: LayoutImageRef | null;
  readonly lines: readonly string[];
  readonly price: string | null;
}

export interface LayoutCodeIndexEntry {
  readonly code: string;
  readonly label: string;
  /** Η άγκυρα της σελίδας όπου τυπώνεται· την αριθμεί η μηχανή, γιατί μόνο εκείνη ξέρει τις σελίδες. */
  readonly anchor: string;
}

export type LayoutBlock =
  | { readonly kind: 'heading'; readonly level: 1 | 2 | 3; readonly text: string; readonly outlined: boolean }
  | { readonly kind: 'paragraph'; readonly inlines: readonly LayoutInline[] }
  | { readonly kind: 'bullets'; readonly ordered: boolean; readonly items: readonly (readonly LayoutInline[])[] }
  | { readonly kind: 'image'; readonly image: LayoutImageRef }
  | { readonly kind: 'table'; readonly table: LayoutTable }
  | { readonly kind: 'grid'; readonly columns: number; readonly cards: readonly LayoutGridCard[] }
  | { readonly kind: 'toc'; readonly title: string }
  | { readonly kind: 'codeIndex'; readonly columns: number; readonly entries: readonly LayoutCodeIndexEntry[] }
  | { readonly kind: 'anchor'; readonly anchor: string };

export interface LayoutSection {
  readonly id: string;
  readonly template: PublicationTemplate;
  readonly blocks: readonly LayoutBlock[];
}

export interface LayoutDocument {
  readonly schemaVersion: number;
  readonly title: string;
  readonly language: HumanLanguage;
  readonly theme: LayoutTheme;
  readonly page: LayoutPage;
  /** Το υποσέλιδο κάθε σελίδας σώματος: «… τιμές έκδοσης 3, ισχύς από 1/11/2026». */
  readonly footer: string;
  readonly sections: readonly LayoutSection[];
}

/** Οι λογικές σελίδες του μοντέλου — η **μόνη** μέτρηση που υπάρχει πριν τρέξει η μηχανή (πρόοδος ανά σελίδα). */
export function countLayoutSections(document: Pick<LayoutDocument, 'sections'>): number {
  return document.sections.length;
}

/** Ποιο αρχείο ζητά ένα προφίλ: εκτύπωση ⇒ πλήρης ανάλυση στον χώρο της πηγής · οθόνη ⇒ ελαφρύ sRGB. */
export function renditionUseOf(profile: PublicationOutputProfile): 'print' | 'web' {
  return profile === 'print' ? 'print' : 'web';
}

/** Όλες οι εικόνες του εγγράφου, μία φορά η καθεμία — ό,τι πρέπει να φτάσει στον φάκελο εργασίας. */
export function collectLayoutAssetIds(document: Pick<LayoutDocument, 'sections'>): string[] {
  const ids = new Set<string>();
  for (const section of document.sections) {
    for (const block of section.blocks) {
      if (block.kind === 'image') ids.add(block.image.assetId);
      if (block.kind === 'grid') for (const card of block.cards) if (card.image) ids.add(card.image.assetId);
    }
  }
  return [...ids].sort();
}
