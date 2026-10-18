'use client';

/**
 * **ΤΟ ΜΗ-ΑΠΟΚΛΕΙΣΤΙΚΟ ΦΥΛΛΟ ΠΥΘΜΕΝΑ** — και, στην ευρεία οθόνη, **η στήλη της λίστας**.
 *
 * ADR-777 Α3 · SPEC-777D §26.2/§26.3/§26.7 · NN/g «Bottom Sheets».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΕΝΑ DOM, ΔΥΟ ΔΙΑΤΑΞΕΙΣ — ΚΑΙ ΓΙ' ΑΥΤΟ ΤΟ «ΜΕΤΡΑΩ ΑΚΟΜΗ» ΔΕΝ ΚΟΣΤΙΖΕΙ ΤΙΠΟΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 🔑 **Η γεωμετρία και η συμπεριφορά είναι ΔΥΟ ερωτήματα, και τα απαντούν δύο μηχανισμοί.**
 *
 * | Ερώτημα | Ποιος απαντά | Πότε |
 * |---|---|---|
 * | «επικάλυψη ή στήλη;» | **CSS**, στο `md` | στο **πρώτο βάψιμο**, στον διακομιστή |
 * | «είναι ενεργές οι στάσεις, το πίσω κουμπί, το κλείδωμα κύλισης;» | **`useViewportClass`** | μετά τη μέτρηση |
 *
 * Αυτό **δεν** είναι δύο απαντήσεις στο ίδιο ερώτημα (ADR-749) — είναι δύο ερωτήματα με
 * **έναν** αριθμό: το `md` του Tailwind **είναι** το `MOBILE_BREAKPOINT`, και το κλειδώνει
 * άγκυρα που ρωτά το ίδιο το Tailwind (`ResultsSheet.layout.test.tsx`).
 *
 * 🔴 **ΓΙΑΤΙ Η ΓΕΩΜΕΤΡΙΑ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΕΙΝΑΙ ΣΕ JavaScript** — μετρημένο, όχι γούστο.
 * Το `useViewportClass` απαντά `measuring` στον διακομιστή και στο πρώτο καρέ, **επίτηδες**.
 * Αν η διάταξη κρεμόταν από αυτό, το `measuring` θα όφειλε να διαλέξει: ό,τι κι αν διάλεγε,
 * **η μία από τις δύο μερίδες κοινού θα έβλεπε πλήρη αναδιάταξη** μετά την ενυδάτωση — και
 * η **Α19** ζητά **CLS < 0,1**, όριο που μια εναλλαγή «στήλες ⇄ επικάλυψη» σπάει κατά τάξη
 * μεγέθους. Με τη γεωμετρία στο CSS, το `measuring` **δεν παράγει καμία διαφορά σχήματος**:
 * το CLS είναι μηδέν **εκ κατασκευής**, όχι επειδή ελπίζουμε ότι η μέτρηση προλαβαίνει.
 * Γι' αυτό και το χρώμιο του φύλλου (λαβή, κουμπιά) αποδίδεται **πάντα** και κρύβεται με
 * `md:hidden`: αν εμφανιζόταν μόλις επιβεβαιωνόταν το «στενή», θα έσπρωχνε το περιεχόμενο
 * προς τα κάτω — δηλαδή θα ξαναγεννούσε την ίδια μετατόπιση σε μικρογραφία.
 *
 * ⛔ **ΠΟΤΕ MODAL** (κανόνας 2). Δεν υπάρχει σκοτεινό στρώμα, δεν υπάρχει παγίδα εστίασης,
 * δεν υπάρχει κλείδωμα κύλισης. Το δοχείο είναι `pointer-events-none` και **μόνο** η ορατή
 * επιφάνεια το ξαναανάβει, ώστε ο χάρτης να **σέρνεται από το κενό** πάνω από το φύλλο.
 * Γι' αυτό **δεν** χρησιμοποιείται το `components/ui/sheet.tsx`: είναι Radix Dialog, δηλαδή
 * modal εξ ορισμού — και ακόμη και με `modal={false}` θα έδινε δύο καταστάσεις (ανοιχτό ή
 * κλειστό), ενώ ο **κανόνας 1** ζητά **τρεις**.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SnapBottomSheet } from '@/components/ui/snap-bottom-sheet/SnapBottomSheet';
import { useSheetSnap } from '@/hooks/media/useSheetSnap';
import type { ViewportClass } from '@/hooks/media/useViewportClass';

import styles from './ResultsSheet.module.css';

/**
 * Η καταχώριση **στην ουρά ιστορικού** που ανήκει σε αυτό το φύλλο.
 *
 * ⚠️ Η συμβολοσειρά είναι **αμετάβλητη επίτηδες**: μέχρι τις 2026-08-11 ζούσε μέσα στο
 * `useSheetBackDismiss` ως μοναδικό, σταθερά γραμμένο κλειδί. Ο μηχανισμός απέκτησε δεύτερο
 * καταναλωτή (ο θεατής, ADR-777 §8.20), οπότε η **ταυτότητα** μετακόμισε στον καλούντα —
 * αλλά η τιμή έμεινε **ίδια χαρακτήρα προς χαρακτήρα**, ώστε η αλλαγή να είναι αποδεδειγμένα
 * χωρίς συνέπεια για ανοιχτές καρτέλες.
 */
const RESULTS_SHEET_HISTORY_KEY = '__resultsSheetExpanded';

interface ResultsSheetProps {
  /** Η **μία** ερώτηση της οθόνης. Οδηγεί **συμπεριφορά**, ποτέ σχήμα. */
  readonly viewport: ViewportClass;
  readonly children: React.ReactNode;
}

/**
 * ADR-912 §12.17 — ο μηχανισμός (άγκυρες, διάκενο, λαβή, κουμπιά στάσεων, «πίσω», κράτημα εσωτερικής κύλισης)
 * μετακόμισε αυτούσιος στο κοινό `SnapBottomSheet`, όταν απέκτησε δεύτερο καταναλωτή (τα στοιχεία ακινήτου). Εδώ μένει
 * ό,τι είναι **δικό** αυτού του φύλλου: η γεωμετρία (`ResultsSheet.module.css` — ματιά 30%, δεν κλείνει ποτέ, ADR-777 Α5)
 * και η φαρδιά του μορφή ως **στήλη πλέγματος**.
 */
export function ResultsSheet({ viewport, children }: ResultsSheetProps) {
  const { t } = useTranslation(['search-results']);
  const controller = useSheetSnap(viewport === 'narrow');

  return (
    <SnapBottomSheet
      controller={controller}
      viewport={viewport}
      historyKey={RESULTS_SHEET_HISTORY_KEY}
      geometryClassName={styles.scroller}
      labels={{
        sheet: t('search-results:sheet.label'),
        less: t('search-results:sheet.moreMap'),
        more: t('search-results:sheet.moreList'),
      }}
      className="md:pointer-events-auto md:static md:z-auto md:snap-none md:overflow-hidden md:border-r md:border-border"
      surfaceClassName="md:h-full md:rounded-none md:border-0 md:bg-background md:shadow-none"
    >
      {children}
    </SnapBottomSheet>
  );
}
