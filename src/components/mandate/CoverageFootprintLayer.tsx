'use client';

/**
 * @fileoverview **ΠΟΥ ΔΟΥΛΕΥΕΙ ΑΥΤΟΣ Ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ — ΠΑΝΩ ΣΤΟΝ ΧΑΡΤΗ** (ADR-896).
 * @related ADR-846 (δηλωμένη εμβέλεια) · ADR-883 (όρια) · ADR-847 (κίνηση κάμερας) · lib/agency/coverage-geometry
 * @module components/mandate/CoverageFootprintLayer
 *
 * 🏆 **Το πρότυπο Google Business Profile** για τις service-area businesses — σχήμα που καλύπτει τις
 * περιοχές εξυπηρέτησης αντί για πινέζα — **με ένα βήμα πέρα**: οι διοικητικές περιοχές
 * ζωγραφίζονται με τα **πραγματικά** τους όρια (Καλλικράτης, ADR-883), όχι ως κύκλοι γύρω από
 * κεντροειδή.
 *
 * 🔑 **ΔΥΟ ΕΝΤΑΣΕΙΣ, ΔΙΑΚΡΙΤΕΣ ΧΩΡΙΣ ΧΡΩΜΑ** (CHECK 3.41 — «ξέρω ΠΟΙΟ είναι ποιο χωρίς να δω χρώμα;»):
 * | εστίαση | γραμμή | γέμισμα | κάμερα |
 * |---|---|---|---|
 * | `peeked` (hover) | **διακεκομμένη** | αχνό | **ακίνητη** — ο χάρτης που τρέχει κάτω από τον δείκτη είναι ναυτία (Airbnb) |
 * | `selected` (κλικ) | **συνεχής** | εντονότερο | **πετά** στο σχήμα (`useCameraFrame`, ADR-847) |
 *
 * ⚠️ **Κάτω από τις πινέζες** (`beforeId: BELOW_LISTINGS`): το σχήμα είναι το πλαίσιο, οι πινέζες
 * το περιεχόμενο — ένα γέμισμα πάνω από αυτές θα τις έκανε δυσανάγνωστες.
 */

import React, { useMemo, useRef } from 'react';

import { Layer, Source, useMap, type MapRef } from '@/lib/maps/maplibre';
import { coverageShape, multiPolygonExtent } from '@/lib/agency/coverage-geometry';
import { useAdminBoundaries } from '@/hooks/geo/useAdminBoundaries';
import { useCameraFrame } from '@/components/geo/use-camera-frame';
import { BELOW_LISTINGS } from '@/components/search-results/boundary-paint';
import { readListingMapPaint } from '@/components/search-results/listing-map-paint';
import type { DeclaredCoverage } from '@/types/agency-coverage';
import type { CameraFrame } from '@/types/geo/camera-frame';
import type { GeoPoint } from '@/types/geo/coordinates';

type CoverageEmphasis = 'peeked' | 'selected';

const FILL_OPACITY: Readonly<Record<CoverageEmphasis, number>> = { peeked: 0.14, selected: 0.24 };
/** Διακεκομμένη = «κοιτάς»· συνεχής = «διάλεξες». Το σχήμα της γραμμής λέει την εστίαση, όχι το χρώμα. */
const PEEKED_DASH = [2, 2];
const LINE_WIDTH = 2;
const HALO_WIDTH = 5;

/** Η γεωμετρία της δήλωσης — ζωγραφισμένη **ή** φορτωμένη από τα όρια. `null` = τίποτα να ζωγραφιστεί. */
function useCoverageGeometry(coverage: DeclaredCoverage | null): GeoJSON.MultiPolygon | null {
  const shape = useMemo(() => coverageShape(coverage), [coverage]);
  const boundaries = useAdminBoundaries(shape.kind === 'admin' ? shape.adminIds : null);
  if (shape.kind === 'drawn') return shape.geometry;
  if (shape.kind === 'admin' && boundaries.status === 'ready') return boundaries.geometry;
  return null;
}

/**
 * Η κάμερα πετά στο σχήμα **μόνο** όταν επιλέχθηκε — ποτέ στο hover.
 *
 * 🔴 **Το κάδρο περιλαμβάνει ΚΑΙ τις πινέζες του** — βρέθηκε στο ζωντανό περπάτημα: γραφείο με
 * κατάστημα στη Θεσσαλονίκη και δηλωμένη περιοχή στην Αθήνα. Κάδρο μόνο στο σχήμα ⇒ η φούσκα της
 * πινέζας (που **άνοιξε** αυτή την επιλογή) έμενε εκτός οθόνης.
 */
function useCoverageCamera(
  geometry: GeoJSON.MultiPolygon | null,
  emphasis: CoverageEmphasis,
  pins: readonly GeoPoint[],
): void {
  const { current } = useMap();
  const mapRef = useRef<MapRef | null>(null);
  mapRef.current = current ?? null;
  const frame = useMemo((): CameraFrame | null => {
    if (emphasis !== 'selected' || geometry === null) return null;
    const extent = multiPolygonExtent(geometry, pins);
    return extent === null ? null : { kind: 'extent', extent };
  }, [geometry, emphasis, pins]);
  useCameraFrame(mapRef, current !== undefined, frame);
}

export function CoverageFootprintLayer({
  coverage,
  emphasis,
  pins,
}: {
  readonly coverage: DeclaredCoverage | null;
  readonly emphasis: CoverageEmphasis;
  /** Οι πινέζες του ίδιου γραφείου — μπαίνουν στο κάδρο της επιλογής μαζί με το σχήμα. */
  readonly pins: readonly GeoPoint[];
}): React.ReactElement | null {
  const geometry = useCoverageGeometry(coverage);
  useCoverageCamera(geometry, emphasis, pins);
  if (geometry === null) return null;

  const paint = readListingMapPaint();
  const dash = emphasis === 'peeked' ? { 'line-dasharray': PEEKED_DASH } : {};

  return (
    <Source id="coverage-footprint" type="geojson" data={geometry}>
      <Layer
        id="coverage-footprint-fill"
        type="fill"
        beforeId={BELOW_LISTINGS}
        paint={{ 'fill-color': paint.mark, 'fill-opacity': FILL_OPACITY[emphasis] }}
      />
      <Layer
        id="coverage-footprint-halo"
        type="line"
        beforeId={BELOW_LISTINGS}
        layout={{ 'line-join': 'round' }}
        paint={{ 'line-color': paint.surface, 'line-width': HALO_WIDTH, 'line-opacity': 0.8 }}
      />
      <Layer
        id="coverage-footprint-line"
        type="line"
        beforeId={BELOW_LISTINGS}
        layout={{ 'line-join': 'round' }}
        paint={{ 'line-color': paint.mark, 'line-width': LINE_WIDTH, ...dash }}
      />
    </Source>
  );
}
