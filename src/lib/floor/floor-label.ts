/**
 * @fileoverview **Η ΜΙΑ ΕΤΙΚΕΤΑ ΟΡΟΦΟΥ** (ADR-903) — client **και** server, ίδια κλειδιά, ίδιο αποτέλεσμα.
 * @module lib/floor/floor-label
 *
 * 🔑 Ο μεταφραστής **περνιέται**: το `t` του i18next (React, μέσω `useFloorLabel`) και το
 * `createBundleTranslate` (server: email, ειδοποιήσεις, showcase/PDF, ai-pipeline — μέσω
 * `floor-label-bundle`) έχουν την **ίδια** υπογραφή. Άρα **μία** υλοποίηση, καμία γλώσσα γραμμένη εδώ
 * (N.11). Αντικατέστησε 8 χειρόγραφους μορφοποιητές που απέκλιναν («1 Floor» · «3nd Basement» ·
 * «Υπόγειο» για −3) και το `formatFloorLabel` που αγνοούσε το είδος.
 *
 * ⚠️ Τα κλειδιά είναι **κυριολεκτικά** στον πίνακα: ο generator των route slices (ADR-744) τα λύνει
 * με `t(FLOOR_LABEL_KEY[kind])` — δυναμικό `` t(`floors:label.${kind}`) `` θα έσπαγε τον slice.
 */

import type { FloorKind } from '@/utils/floor-naming';
import { resolveFloorKind, type FloorRef } from './floor-ref';

/**
 * Οι παράμετροι που δίνονται σε **κάθε** κλειδί ετικέτας. `type`, όχι `interface`: μόνο το
 * type literal χωρά σε `Record<string, unknown>` (σιωπηρή υπογραφή δείκτη).
 */
type FloorLabelParams = {
  readonly n: number;
  readonly depth: number;
  readonly index: number;
};

/**
 * Ο μεταφραστής που ζητά ο μορφοποιητής. Στενός **επίτηδες**: το `t` του i18next και το
 * `BundleTranslate` χωρούν και τα δύο, χωρίς μετατροπή τύπου.
 */
export type FloorLabelTranslate = (key: string, params: FloorLabelParams) => string;

export const FLOOR_LABEL_KEY: Readonly<Record<FloorKind, string>> = {
  foundation: 'floors:label.foundation',
  basement: 'floors:label.basement',
  'semi-basement': 'floors:label.semiBasement',
  ground: 'floors:label.ground',
  'raised-ground': 'floors:label.raisedGround',
  pilotis: 'floors:label.pilotis',
  standard: 'floors:label.standard',
  mezzanine: 'floors:label.mezzanine',
  attic: 'floors:label.attic',
  roof: 'floors:label.roof',
  'stair-penthouse': 'floors:label.stairPenthouse',
};

/**
 * Η ετικέτα μιας στάθμης: «3ος Όροφος» / «3rd Floor» · «2ο Υπόγειο» / «Basement 2» · «Πυλωτή» / «Pilotis».
 * Οι παράμετροι δίνονται **πάντα** όλες — κάθε κλειδί παίρνει όποια χρειάζεται.
 */
export function formatFloorRef(ref: FloorRef, t: FloorLabelTranslate): string {
  const kind = resolveFloorKind(ref);
  const magnitude = Math.abs(ref.number ?? 0) || 1;
  return t(FLOOR_LABEL_KEY[kind], { n: ref.number ?? 0, depth: magnitude, index: magnitude });
}
