'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** του ανάγλυφου (ADR-920 Β6.6 · ADR-280 §11.8 Β4.1 · ADR-744 §27).
 * @module components/listing-detail/terrain/terrain-surfaces
 *
 * Δύο επιφάνειες: η **σκηνή του χάρτη** (`TerrainSnapshotStage`, όταν φτάσει το στιγμιότυπο) και ο **θεατής 3Δ** (three +
 * κύβος, μόνο μετά το «Προβολή σε 3Δ»). Στατικά στη σελίδα αγγελίας ο χάρτης μεγάλωνε το slice της 20.525 → 26.321 bytes
 * (πάνω από το ταβάνι, μετρημένο)· με σκέτο `next/dynamic` chunk και κείμενα (`listing-detail`) θα ήταν δύο ανεξάρτητα
 * αιτήματα που η σελίδα δεν περιμένει ⇒ ωμά κλειδιά (χρέος εισδοχής). Εδώ κώδικας και κείμενα ταξιδεύουν ως **ένα**
 * αίτημα· τα namespaces τα λέει ο παραγόμενος χάρτης `lazy-route-namespaces.json` (δηλωμένα στο `.i18n-shell-slice.json`).
 *
 * Λεπτό μητρώο: εισάγει μόνο το factory, το κουτί της σκηνής και τη μία πρόταση αναμονής.
 * ⚠️ Δηλωμένο στο `lazyRouteRegistries` (`scripts/lib/i18n-shell-slice/config.js`) — αλλιώς ο γεννήτορας αρνείται.
 */

import type { ComponentType } from 'react';

import { LISTING_STAGE_NOTICE_BOX } from '@/components/listing-detail/ListingStageFailure';
import { MODEL_STAGE_ASPECT_CLASS } from '@/components/listing-detail/listing-model-stage-metrics';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

// ⚠️ Οι τύποι από αρχείο ΜΟΝΟ-τύπων, ποτέ από τα components: ο γράφος της 3.34 μετρά και το `import type` ως ακμή.
import type { Terrain3dCanvasProps, TerrainSnapshotStageProps } from './terrain-surface-props';

/**
 * Το **ένα** κουτί κάθε κατάστασης της σκηνής εδάφους (φόρτωση · αποτυχία · κάρτα εισόδου · χωρίς WebGL) — ίδια αναλογία
 * με τον καμβά ⇒ καμία μετατόπιση όταν αλλάζει η κατάσταση.
 */
export const TERRAIN_STAGE_NOTICE_BOX = `${LISTING_STAGE_NOTICE_BOX} ${MODEL_STAGE_ASPECT_CLASS}`;

/** Όσο φτάνουν κώδικας και κείμενα του 3Δ — απάντηση σε πράξη του ανθρώπου, άρα εδώ το «φορτώνει» επιτρέπεται. */
export function Terrain3dPending() {
  const { t } = useTranslation(['listing-detail']);
  return (
    <Card asChild className={TERRAIN_STAGE_NOTICE_BOX}>
      <section aria-live="polite">
        <p className="m-0 text-sm text-muted-foreground">{t('listing-detail:terrain.view.threeD.loading')}</p>
      </section>
    </Card>
  );
}

/** Όσο φτάνουν ο χάρτης και τα κείμενά του — η ΙΔΙΑ πρόταση με τη φόρτωση του στιγμιοτύπου (ένα «φορτώνει», όχι δύο). */
export function TerrainStagePending() {
  const { t } = useTranslation(['listing-detail']);
  return (
    <Card asChild className={TERRAIN_STAGE_NOTICE_BOX}>
      <section aria-live="polite" data-listing-terrain-stage="loading">
        <p className="m-0 text-sm text-muted-foreground">{t('listing-detail:terrain.panel.loading')}</p>
      </section>
    </Card>
  );
}

export const TerrainSurfaces = defineLazySurfaces({
  /** Ο χάρτης + «Κάτοψη | 3Δ» ενός στιγμιοτύπου (`ListingTerrainPanel`, όταν φτάσει το στιγμιότυπο). */
  TerrainSnapshotStage: {
    load: () => import('@/components/listing-detail/terrain/TerrainSnapshotStage'),
    fallback: TerrainStagePending,
  },
  /** Ο θεατής 3Δ του εδάφους (`TerrainViewStage`, καρτέλα «3Δ», μετά την κάρτα εισόδου). */
  Terrain3dCanvas: {
    load: () => import('@/components/listing-detail/terrain/3d/Terrain3dCanvas'),
    fallback: Terrain3dPending,
  },
});

// Τα components με τα props τους — το εργοστάσιο δέχεται οποιοδήποτε component, εδώ ξαναδένεται ο τύπος.
export const LazyTerrainSnapshotStage: ComponentType<TerrainSnapshotStageProps> = TerrainSurfaces.TerrainSnapshotStage;
export const LazyTerrain3dCanvas: ComponentType<Terrain3dCanvasProps> = TerrainSurfaces.Terrain3dCanvas;
