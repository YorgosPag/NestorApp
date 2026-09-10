'use client';

/**
 * @fileoverview **ΤΟ ΣΗΜΕΙΟ ΠΟΥ ΕΒΑΛΕ ΑΝΘΡΩΠΟΣ ΣΕ ΜΙΑ ΦΟΡΜΑ** — ADR-332 D27 Βήμα Β.
 * @related editor/hooks/useAddressEditorDrag (`placement`) · pin-drop (`humanPlacedPatch`)
 *
 * 🔴 **Τρεις φόρμες, τρεις συμπεριφορές, καμία σωστή** (μετρημένο 2026-09-10):
 * - **Προσθήκη έργου**: η θέση γραφόταν **πριν** τον διάλογο ⇒ το «Άκυρο» την **αποθήκευε**.
 * - **Επεξεργασία έργου**: η θέση **δεν** αποθηκευόταν ποτέ (το κείμενο μόνο).
 * - **Κτίρια**: το ίδιο — ο διακομιστής ξαναρωτούσε τη μηχανή για το κείμενο.
 *
 * 🔑 Εδώ η θέση υπάρχει **μόνο αφού την επιβεβαιώσει άνθρωπος** (`onPlace`), και η αναίρεση
 * την επαναφέρει (`onRestore`). Η **μαντεμένη** πινέζα (κεντροειδές, μετατόπιση, κέντρο
 * Αθήνας) **δεν** περνά ποτέ από εδώ — είναι οπτικό βοήθημα, όχι δήλωση (ADR-332 D25).
 */

import { useCallback, useMemo, useState } from 'react';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { AddressEditorPlacementOptions } from './editor/AddressEditor.types';
import { humanPlacedPatch, type HumanPlacedPatch } from './pin-drop';

export interface FormPlacedPoint {
  /** Το σημείο που επιβεβαίωσε άνθρωπος σε αυτή τη φόρμα — `null` αν δεν έχει τοποθετήσει. */
  readonly point: GeoPoint | null;
  /** Δίνεται αυτούσιο στον `AddressEditor` — ενεργοποιεί «Μόνο η θέση» και αναίρεση πινέζας. */
  readonly placement: AddressEditorPlacementOptions;
  /** Τα πεδία προς αποθήκευση: η δήλωση ανθρώπινης θέσης, ή **τίποτα**. */
  readonly addressPatch: HumanPlacedPatch | Record<string, never>;
  /** Κλείσιμο / άνοιγμα φόρμας. */
  readonly reset: () => void;
}

export function useFormPlacedPoint(): FormPlacedPoint {
  const [point, setPoint] = useState<GeoPoint | null>(null);

  const placement = useMemo<AddressEditorPlacementOptions>(
    () => ({ onPlace: setPoint, onRestore: setPoint }),
    [],
  );
  const reset = useCallback(() => setPoint(null), []);
  const addressPatch = useMemo(() => (point ? humanPlacedPatch(point) : {}), [point]);

  return { point, placement, addressPatch, reset };
}
