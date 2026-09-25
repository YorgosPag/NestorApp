'use client';

/**
 * # ΤΟ ΟΡΙΟ ΤΗΣ ΠΕΡΙΟΧΗΣ ΣΤΟΝ ΧΑΡΤΗ — περίγραμμα + μάσκα εκτός (ADR-883)
 *
 * Τρία επίπεδα, **κάτω** από τα σχήματα των αγγελιών (`beforeId`):
 *
 * | Επίπεδο | Χρώμα | Γιατί |
 * |---|---|---|
 * | μάσκα εκτός περιοχής | `--bg-overlay`, διαφανές | σκοτεινό **και στα δύο θέματα** — σκουραίνει ό,τι δεν ζητήθηκε |
 * | φωτοστέφανο γραμμής | `--card` | ξεχωρίζει τη γραμμή από οποιοδήποτε υπόβαθρο (δρόμοι, θάλασσα, δορυφόρος) |
 * | γραμμή ορίου | `--foreground` | μέγιστη αντίθεση με το υπόβαθρο του ίδιου θέματος |
 *
 * 🔑 **Κάτω από τις πινέζες, επίτηδες**: το όριο είναι **πλαίσιο**, όχι περιεχόμενο. Πάνω από
 * αυτές θα έκλεβε κλικ και θα έκρυβε αγγελίες που κάθονται ακριβώς στο σύνορο — εκεί όπου η
 * λογιστική λέει «ίσως» και ο άνθρωπος θέλει να **δει**.
 *
 * ⚖️ **Η αναφορά πηγής ζει ΠΑΝΩ ΣΤΗΝ ΠΗΓΗ** (`attribution`): το MapLibre τη δείχνει στο πλαίσιο
 * αναφορών **όσο** η πηγή είναι στον χάρτη, και τη σβήνει μόλις φύγει το όριο. Η CC-BY 3.0
 * ζητά αναφορά **εκεί που χρησιμοποιούνται** τα δεδομένα — ούτε λιγότερο, ούτε παντού.
 */

import React, { useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Layer, Source } from '@/lib/maps/maplibre';
import { regionMaskGeometry } from '@/lib/geo/geo-region-mask';
import { readRootCssVar } from '@/subapps/dxf-viewer/config/color-config';

/** Το πρώτο επίπεδο των αγγελιών — το όριο ζωγραφίζεται **πριν** από αυτό (δες `ResultsMapSources`). */
const BELOW_LISTINGS = 'listing-outline-fill';

interface AdminBoundaryLayerProps {
  readonly geometry: GeoJSON.MultiPolygon;
}

function readBoundaryPaint(): { readonly line: string; readonly halo: string; readonly mask: string } {
  return {
    line: `hsl(${readRootCssVar('--foreground', '222 47% 11%')})`,
    halo: `hsl(${readRootCssVar('--card', '0 0% 100%')})`,
    mask: `hsl(${readRootCssVar('--bg-overlay', '220 26% 14%')})`,
  };
}

export function AdminBoundaryLayer({ geometry }: AdminBoundaryLayerProps) {
  const { t, isNamespaceReady } = useTranslation(['search-region']);
  const mask = useMemo(() => regionMaskGeometry(geometry), [geometry]);
  const paint = readBoundaryPaint();

  return (
    <>
      <Source id="admin-boundary-mask" type="geojson" data={mask}>
        <Layer
          id="admin-boundary-mask-fill"
          type="fill"
          beforeId={BELOW_LISTINGS}
          paint={{ 'fill-color': paint.mask, 'fill-opacity': 0.22 }}
        />
      </Source>
      <Source
        id="admin-boundary"
        type="geojson"
        data={geometry}
        attribution={isNamespaceReady ? t('search-region:boundary.attribution') : undefined}
      >
        <Layer
          id="admin-boundary-halo"
          type="line"
          beforeId={BELOW_LISTINGS}
          layout={{ 'line-join': 'round' }}
          paint={{ 'line-color': paint.halo, 'line-width': 6, 'line-opacity': 0.85 }}
        />
        <Layer
          id="admin-boundary-line"
          type="line"
          beforeId={BELOW_LISTINGS}
          layout={{ 'line-join': 'round' }}
          paint={{ 'line-color': paint.line, 'line-width': 2.5 }}
        />
      </Source>
    </>
  );
}
