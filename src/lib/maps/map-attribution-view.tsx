'use client';

/**
 * @fileoverview **Η ΑΠΟΔΟΣΗ ΤΟΥ ΧΑΡΤΗ, ΟΡΑΤΗ** — μία εμφάνιση, για τον ζωντανό χάρτη και για το στιγμιότυπο (ADR-891 §8).
 * @related `lib/maps/maplibre.ts` (το σύνορο που τη βάζει σε ΚΑΘΕ χάρτη) · `lib/maps/map-attribution.ts` (η ανάγνωση)
 * @module lib/maps/map-attribution-view
 *
 * 🔴 **ΓΙΑΤΙ ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟΝ ΚΑΘΕ ΧΑΡΤΗ** (μετρημένο 2026-09-27): το `attributionControl={false}` ήταν σε
 * **πέντε** χάρτες, με τον κανόνα «κάθε καταναλωτής γράφει τη γραμμή μόνος του». Πέντε σελίδες τη γράφανε
 * (από **μετάφραση**, όχι από την πηγή) και **πέντε χάρτες την ξέχασαν** — ανάμεσά τους η **δημόσια** σελίδα
 * περιοχής (`/area`). Η απόδοση του OpenStreetMap είναι **όρος της άδειας ODbL**, όχι διακόσμηση.
 *
 * 🔑 **Πάντα ορατή, ποτέ πίσω από «ⓘ»**: το «compact» του MapLibre κρύβει το κείμενο σε στενούς χάρτες — ακριβώς
 * εκεί που ζουν οι δικοί μας (κάρτες, φόρμες, κινητό). Θεματικά χρώματα (`bg-card`), όχι το λευκό κουτί της βιβλιοθήκης.
 *
 * ⚠️ Το κείμενο **δεν** περνά από `t()`: είναι νομικός όρος και εμπορικό σήμα, όπως τον δηλώνει ο πάροχος.
 */

import React, { useCallback, useState } from 'react';

import { mapAttribution, sameAttribution, type AttributedMap, type MapAttributionSegment } from './map-attribution';

interface MapAttributionTextProps {
  readonly segments: readonly MapAttributionSegment[];
  /** `figcaption` μέσα σε `<figure>` (στιγμιότυπο)· `small` πάνω στον ζωντανό χάρτη (ψιλά γράμματα, HTML). */
  readonly as: 'figcaption' | 'small';
}

export function MapAttributionText({ segments, as }: MapAttributionTextProps): React.ReactElement | null {
  if (segments.length === 0) return null;
  return React.createElement(
    as,
    { className: 'absolute bottom-0 right-0 rounded-tl bg-card px-1 text-[0.625rem] leading-tight text-card-foreground' },
    segments.map((segment, i) =>
      segment.href === undefined ? (
        <React.Fragment key={i}>{segment.text}</React.Fragment>
      ) : (
        <a key={i} href={segment.href} target="_blank" rel="noopener noreferrer" className="underline">
          {segment.text}
        </a>
      ),
    ),
  );
}

/**
 * Η απόδοση του **ζωντανού** χάρτη: `observe(map)` σε κάθε `load` / `styledata` / `sourcedata` μεταδεδομένων.
 * Κρατά την **ίδια** αναφορά όσο το κείμενο δεν αλλάζει ⇒ καμία επαναζωγράφιση ανά πλακίδιο.
 */
export function useMapAttribution(): readonly [readonly MapAttributionSegment[], (map: AttributedMap) => void] {
  const [segments, setSegments] = useState<readonly MapAttributionSegment[]>([]);
  const observe = useCallback((map: AttributedMap) => {
    const next = mapAttribution(map);
    setSegments((previous) => (sameAttribution(previous, next) ? previous : next));
  }, []);
  return [segments, observe];
}
