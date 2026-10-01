'use client';

/**
 * @fileoverview **ΛΙΣΤΑ ‖ ΧΑΡΤΗΣ ΩΣ ΟΘΟΝΗ** — το δεύτερο σχήμα της ίδιας διάταξης: κάδρο κλειδωμένο στο
 * παράθυρο, λίστα που κυλά στη στήλη της, και στο στενό **φύλλο πυθμένα** πάνω από τον χάρτη.
 * @related ADR-777 §8.84 · ADR-896 §4.5 · SPEC-777D §26 · components/shared/list-map/list-map-layout
 * @module components/shared/list-map/ListMapScreen
 *
 * 🔑 **Αδελφός του `ListMapSplit`, όχι λειτουργία του.** Το `ListMapSplit` είναι σελίδα που κυλά και
 * μετρά τον περιέκτη σε JS· εδώ η γεωμετρία είναι **μόνο CSS**, ώστε το CLS να είναι μηδέν εκ
 * κατασκευής. Ένα συστατικό με διακόπτη `presentation` θα είχε άλλα hooks, άλλο DOM και ένα `if` σε
 * κάθε γραμμή — δύο συστατικά σε ένα παλτό. Κοινό είναι ό,τι **πρέπει** να είναι κοινό: η γεωμετρία
 * (`list-map-layout`), η εστίαση, ο δείκτης άκρης, ο μηχανισμός του φύλλου.
 *
 * ⚠️ Το `viewport` οδηγεί **μόνο συμπεριφορά** (στάσεις, πίσω κουμπί) μέσα στο `ResultsSheet` —
 * **ποτέ** σχήμα: καμία κλάση εδώ δεν εξαρτάται από αυτό (άγκυρα `ListMapScreen.test.tsx`).
 *
 * ⚠️ **Η λίστα πρώτη στο DOM**: είναι το μέσο που το 65% χρησιμοποιεί πραγματικά (SPEC-777D §25.3).
 * Στο στενό είναι **δεύτερη** στο βάψιμο, γι' αυτό το φύλλο ζητά τοπική στρώση (`z-10`).
 */

import React from 'react';

import type { ViewportClass } from '@/hooks/media/useViewportClass';
import { ResultsSheet } from '@/components/search-results/ResultsSheet';

import { LIST_MAP_SCREEN_FRAME, LIST_MAP_SCREEN_MAP_PANE } from './list-map-layout';

export interface ListMapScreenProps {
  /** Η **μία** ερώτηση πλάτους της οθόνης (`useViewportClass`) — συμπεριφορά, ποτέ σχήμα. */
  readonly viewport: ViewportClass;
  /** Η λίστα — κυλά **η ίδια** (`data-list-scroll`), ώστε το φύλλο να κρατά την κύλισή της. */
  readonly list: React.ReactNode;
  /** Ο χάρτης και ό,τι κάθεται πάνω του, μέσα στο **ίδιο** `isolate`. */
  readonly map: React.ReactNode;
  /** Το ήδη μεταφρασμένο όνομα της περιοχής του χάρτη. */
  readonly mapLabel: string;
}

export function ListMapScreen({ viewport, list, map, mapLabel }: ListMapScreenProps): React.ReactElement {
  return (
    <div data-list-map-presentation="screen" className={LIST_MAP_SCREEN_FRAME}>
      <ResultsSheet viewport={viewport}>{list}</ResultsSheet>
      <section aria-label={mapLabel} className={LIST_MAP_SCREEN_MAP_PANE}>
        {map}
      </section>
    </div>
  );
}
