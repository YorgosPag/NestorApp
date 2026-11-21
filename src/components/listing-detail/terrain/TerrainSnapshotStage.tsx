'use client';

/**
 * @fileoverview **Η ΣΚΗΝΗ ΕΝΟΣ ΣΤΙΓΜΙΟΤΥΠΟΥ ΕΔΑΦΟΥΣ** — ο χάρτης για το πλάτος που φαίνεται, μέσα στο «Κάτοψη | 3Δ»
 *   (ADR-920 Β6.6).
 * @related ./terrain-surfaces (κατεβαίνει ΜΟΝΟ από εκεί, μαζί με τα κείμενά του) · ./ListingTerrainPanel (ο καταναλωτής) ·
 *   ./TerrainViewStage · lib/terrain/publication/terrain-map-model
 * @module components/listing-detail/terrain/TerrainSnapshotStage
 *
 * 🔑 **Τεμπέλικη επιφάνεια, όχι μέρος της σελίδας**: ο χάρτης, οι καρτέλες και τα κείμενά τους δεν μπαίνουν στο slice ούτε
 *   στο bundle της σελίδας αγγελίας — κατεβαίνουν **παράλληλα** με το στιγμιότυπο, όταν ανοίξει η καρτέλα «Ανάγλυφο».
 * 🔑 **Ο χάρτης χτίζεται για το πλάτος που φαίνεται** (`terrainMapWidthClassOf`, §13.8 απόφαση 4): ο καλών μετρά ήδη όσο
 *   κατεβαίνουν, άρα το μοντέλο υπολογίζεται μία φορά (το πολύ 4 κλάσεις). Χωρίς μέτρηση ⇒ οι αναλογίες του σχεδίου.
 */

import { useMemo } from 'react';

import { terrainMapModelOf } from '@/lib/terrain/publication/terrain-map-model';

import type { TerrainSnapshotStageProps } from './terrain-surface-props';
import { TerrainViewStage } from './TerrainViewStage';

export default function TerrainSnapshotStage({ snapshot, widthClass }: TerrainSnapshotStageProps) {
  const model = useMemo(
    () => terrainMapModelOf(snapshot, [], widthClass === null ? null : { widthPx: widthClass }),
    [snapshot, widthClass],
  );
  return <TerrainViewStage model={model} snapshot={snapshot} />;
}
