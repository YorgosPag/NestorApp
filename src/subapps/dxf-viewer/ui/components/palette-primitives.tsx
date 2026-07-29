'use client';

/**
 * ADR-724 §14.7 — Το **δομικό λεξιλόγιο** της αριστερής παλέτας: ένα group, μία γραμμή.
 *
 * ── ΤΙ ΑΝΤΙΚΑΤΕΣΤΗΣΕ ──
 *
 * Δύο σχήματα ήταν αντιγραμμένα σε 6 σημεία **το καθένα** (μετρημένο 2026-07-29):
 *
 *   group  → `<section className="flex flex-col gap-1">` + επικεφαλίδα + περιεχόμενο
 *            σε `EntityPropertyRow` · `BeamAdvancedPanel` · `ImportedMeshAdvancedPanel` (×3) ·
 *            `SlabOpeningAdvancedPanel`
 *   γραμμή → `<div className="flex items-center justify-between gap-2 py-0.5">` + ετικέτα
 *            σε `BimPropertyRow` (×2) · `EntityPropertyRow` (×4)
 *
 * ⚠️ **Κανένα εργαλείο δεν τα έβλεπε.** Το `jscpd` (CHECK 3.28) έχει κατώφλι **50 tokens** και
 * κάθε εμφάνιση είναι ~20 ⇒ μονίμως καθαρό. Το `ssot:discover` (CHECK 3.18) σαρώνει μόνο
 * `src/config|utils|lib` σε βάθος 1 ⇒ δεν ανοίγει ποτέ αυτό το δέντρο. Βρέθηκαν με **ανάγνωση**,
 * κατά τη Φ4 του ADR-724. Το «0 παραβιάσεις» σήμαινε «κανείς δεν κοίταξε».
 *
 * ── ΤΙ ΔΕΝ ΙΣΟΠΕΔΩΘΗΚΕ (η παγίδα αυτού του refactor) ──
 *
 * Τα 6 group **δεν** είναι ίδια, και η ομοιότητα του markup το έκρυβε. Διαφέρουν σε **τρία**
 * πραγματικά πράγματα, που έγιναν props αντί να εξαφανιστούν:
 *
 *   1. **Επίπεδο επικεφαλίδας** (`h3` vs `h4`) — δομή εγγράφου, όχι στυλ. Το
 *      `EntityPropertySection` ζει στη ρίζα μιας καρτέλας· τα advanced panels φωλιάζουν πιο βαθιά.
 *      Ένα σταθερό επίπεδο θα χαλούσε το περίγραμμα για τον αναγνώστη οθόνης.
 *   2. **Τόνος τίτλου** (`plain` vs `overline`) — το panel εισαγόμενων πλεγμάτων (ADR-683)
 *      χρησιμοποιεί κεφαλαία/αραιά/muted. Είναι **επιλογή σχεδιασμού του**, όχι απόκλιση.
 *   3. **Ομοιομορφία γραμμών** (`uniformRows`) — δες παρακάτω· **μόνο 2 από τα 6** την έχουν.
 *
 * @see ADR-724 §9.1 / §14.6.3α — γιατί η πυκνότητα είναι opt-in
 * @see ../workspace-palette-density.module.css — ο ΕΝΑΣ τόπος των κατωφλίων
 */

import React from 'react';

/**
 * Ο τόνος του τίτλου. **Δεν** είναι διακοσμητικό: το `overline` είναι η καθιερωμένη γλώσσα του
 * `ImportedMeshAdvancedPanel` (ADR-683) και η ισοπέδωσή του θα άλλαζε την όψη εκείνου του panel.
 */
export type PaletteGroupTone = 'plain' | 'overline';

const TONE_CLASS: Readonly<Record<PaletteGroupTone, string>> = {
  plain: 'text-xs font-semibold text-foreground',
  overline: 'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
};

export interface PaletteGroupSectionProps {
  /** Ήδη μεταφρασμένος τίτλος — η μετάφραση ανήκει στον καλούντα (N.11: μηδέν κλειδί εδώ). */
  readonly title: string;
  /** Επίπεδο επικεφαλίδας. Δομή εγγράφου: ρίζα καρτέλας = 3, φωλιασμένο panel = 4 (προεπιλογή). */
  readonly headingLevel?: 3 | 4;
  readonly tone?: PaletteGroupTone;
  /**
   * Δηλώνει ότι τα παιδιά είναι **ομοιόμορφες** γραμμές ετικέτα/χειριστήριο σταθερού ύψους,
   * άρα το group επιτρέπεται να πάει σε **δύο στήλες** όταν η παλέτα ξεπεράσει τα 520px
   * (ADR-724 §9.1). Εκπέμπει `data-palette-rows`.
   *
   * ⛔ **ΜΗΝ το βάλεις «για να κερδίσεις χώρο»** αν το group περιέχει `<ul>`, `<dl>`, swatch,
   * δέντρο ή οτιδήποτε μεταβλητού ύψους: η δεύτερη στήλη θα το τεμαχίσει ή θα το εκτοξεύσει
   * ολόκληρο δεξιά. Τεκμηριωμένα **4 από τα 6** group της παλέτας ΔΕΝ το δικαιούνται
   * (ADR-724 §14.6.3α).
   *
   * Το χαρακτηριστικό είναι **αδρανές εκτός παλέτας**: χωρίς τον `dxf-palette` container δεν
   * υπάρχει κανείς να το απαντήσει, οπότε τα ίδια components μέσα σε διαλόγους μένουν μονόστηλα
   * χωρίς δεύτερο κλάδο κώδικα.
   */
  readonly uniformRows?: boolean;
  readonly children: React.ReactNode;
}

/**
 * Ένα τιτλοφορημένο group της παλέτας (Γενικά / Μοτίβο / Δομικά / Προμέτρηση / …).
 *
 * ⚠️ Η επικεφαλίδα είναι **άμεσο παιδί** του `<section>`, σκόπιμα. Τρία από τα σημεία που
 * αντικατέστησε την τύλιγαν σε `<header>` — περιτύλιγμα γύρω από **μία** επικεφαλίδα δεν
 * προσθέτει σημασιολογία (δεν υπάρχει τίποτα να ομαδοποιηθεί μαζί της) και **σπάει** τον κανόνα
 * `[data-palette-rows] > h3, > h4` του §9.1, που χρειάζεται τη σχέση άμεσου παιδιού για να
 * απλώσει τον τίτλο και στις δύο στήλες. Οπτικά ταυτόσημο (`<header>` και `<h4>` είναι και τα
 * δύο block σε flex column).
 */
export function PaletteGroupSection({
  title,
  headingLevel = 4,
  tone = 'plain',
  uniformRows = false,
  children,
}: PaletteGroupSectionProps): React.ReactElement {
  const heading = React.createElement(
    `h${headingLevel}`,
    { className: TONE_CLASS[tone] },
    title,
  );

  return (
    <section className="flex flex-col gap-1" data-palette-rows={uniformRows || undefined}>
      {heading}
      {children}
    </section>
  );
}

export interface PaletteFieldRowProps {
  /** Ήδη μεταφρασμένη ετικέτα. Χρησιμεύει ΚΑΙ ως `aria-label` του χειριστηρίου — δώσ' το εκεί. */
  readonly label: string;
  /** Το χειριστήριο: select / input / switch / swatch / ένδειξη μόνο-ανάγνωσης. */
  readonly children: React.ReactNode;
}

/**
 * Μία γραμμή ιδιότητας: ετικέτα αριστερά (κόβεται με «…»), χειριστήριο δεξιά.
 *
 * Το `truncate` στην ετικέτα είναι αυτό που κάνει τη γραμμή **ανθεκτική στο στένεμα** της
 * παλέτας — γι' αυτό ζει εδώ και όχι στον καλούντα: έξι αντίγραφα σήμαιναν έξι ευκαιρίες να
 * ξεχαστεί, και το πρώτο που θα το ξεχνούσε θα έσπρωχνε το χειριστήριο εκτός οθόνης.
 */
export function PaletteFieldRow({ label, children }: PaletteFieldRowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
