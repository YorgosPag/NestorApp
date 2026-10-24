'use client';

/**
 * @fileoverview **ΟΙ ΚΛΑΣΕΙΣ ΚΛΙΣΗΣ ΩΣ ΠΙΝΑΚΑΣ** — το υπόμνημα του χρώματος ΚΑΙ η εναλλακτική του χάρτη σε κείμενο (ADR-920 Β4.8, Α6).
 * @related ./TerrainContourMap (ο καλών) · ./terrain-map-symbols (`SlopeSwatch` — το ίδιο γέμισμα με τον χάρτη) · ./terrain-map-words
 * @module components/listing-detail/terrain/TerrainSlopeTable
 *
 * 🔑 **Ένα στοιχείο, δύο ρόλοι**: το συνηθισμένο είναι υπόμνημα (δείγμα + εύρος) **και** κρυφός πίνακας δεδομένων για αναγνώστη
 *   οθόνης — το ίδιο περιεχόμενο δύο φορές, που ακούγεται διπλό και αποκλίνει στην πρώτη αλλαγή. Εδώ ο **ορατός** πίνακας είναι
 *   το υπόμνημα: δείγμα · εύρος · % εμβαδού. Ο βλέπων διαβάζει το χρώμα, ο αναγνώστης οθόνης τον πίνακα (WCAG 1.1.1 · 1.4.1).
 * 📊 **Πέρα από τους μεγάλους**: Civil 3D / ArcGIS δείχνουν μόνο το εύρος της κλάσης· ο αγοραστής ρωτά «**πόσο** από το
 *   οικόπεδο είναι απότομο;» — το % του εμβαδού (σε κάτοψη) το απαντά. Οι κενές κλάσεις μένουν, με 0 %: η κλίμακα φαίνεται ολόκληρη.
 */

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TerrainMapSlopeRegion } from '@/lib/terrain/publication/terrain-map-regions';

import { terrainSlopeFillClass } from './terrain-map-palette';
import { SlopeSwatch } from './terrain-map-symbols';
import { areaShareLabel, slopeRangeLabel } from './terrain-map-words';

type T = ReturnType<typeof useTranslation>['t'];

const NS = 'listing-detail:terrain.map.slope';

export interface TerrainSlopeTableProps {
  readonly regions: readonly TerrainMapSlopeRegion[];
  readonly t: T;
}

export function TerrainSlopeTable({ regions, t }: TerrainSlopeTableProps) {
  return (
    <table className="w-full border-collapse text-left text-sm" data-terrain-slope-table="">
      <caption className="pb-1 text-left text-xs font-medium text-muted-foreground">{t(`${NS}.caption`)}</caption>
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th scope="col" className="py-1 pr-3 font-medium">{t(`${NS}.class`)}</th>
          <th scope="col" className="py-1 text-right font-medium">{t(`${NS}.share`)}</th>
        </tr>
      </thead>
      <tbody>
        {regions.map((region) => (
          <tr key={region.classIndex} data-slope-class={region.classIndex} className="border-t border-border">
            <th scope="row" className="py-1 pr-3 font-normal text-foreground">
              <span className="flex items-center gap-2">
                <SlopeSwatch fillClass={terrainSlopeFillClass(region.classIndex)} classIndex={region.classIndex} />
                <span className="tabular-nums">{slopeRangeLabel(t, region)}</span>
              </span>
            </th>
            <td className="py-1 text-right tabular-nums text-foreground">{areaShareLabel(t, region.areaShare)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
