'use client';

/**
 * @fileoverview Η τεμπέλικη **επιφάνεια** του θεατή κατόψεων (ADR-954 §2 · ADR-280 §11.8 Β4.1 · ADR-744 §27).
 * @module components/shared/files/media/floorplan-gallery-surfaces
 *
 * 🔴 **Γιατί όριο εδώ (μετρημένο 2026-11-27, στατικός γράφος χωρίς type-only ακμές).** Το `FloorplanGallery` είναι ο
 *   θεατής DXF/BIM μόνο-ανάγνωσης: εισάγει στατικά το 3Δ (`BimViewport3D`), το `DxfRenderer`, το snap. Με στατική
 *   εισαγωγή, κάθε σελίδα που έχει **καρτέλα** κάτοψης (ακίνητα, κτίρια, έργα) μεταγλώττιζε **2.540** αρχεία του
 *   `dxf-viewer` (`/properties`: 5.457 αρχεία) — για ένα πάνελ που ανοίγει μόνο με κλικ. Με το όριο: **378** dxf / 3.101.
 *   Πρακτική Figma / VS Code / Closure `ModuleManager`: ο βαρύς θεατής είναι **module που φορτώνει στη χρήση**, και τα
 *   κείμενά του ταξιδεύουν **μαζί** με τον κώδικα (ένα αίτημα, CHECK 3.34) — ποτέ ωμά κλειδιά στο πρώτο καρέ.
 *
 * 🔑 **Δύο κλειδιά, ένα chunk.** Το `fallback` δεν βλέπει props, και η όψη αναμονής πρέπει να κρατά τη θέση της
 *   κάτοψης στη **δική της** διάταξη (`flow` · `fill`, ADR-912 §12.17). Ο ίδιος specifier ⇒ ο bundler βγάζει **ένα**
 *   chunk· ο `LazyFloorplanGallery` διαλέγει κλειδί από το `layout`, άρα ο καταναλωτής δεν ξέρει ότι υπάρχουν δύο.
 *
 * Λεπτό μητρώο: εισάγει μόνο το factory, την όψη αναμονής και τύπους από αρχείο **μόνο-τύπων**.
 * ⚠️ Δηλωμένο στο `lazyRouteRegistries` (`scripts/lib/i18n-shell-slice/config.js`) — αλλιώς ο γεννήτορας αρνείται.
 * ⚠️ **ΜΗΝ** εισαγάγεις στατικά το `FloorplanGallery` (ούτε μέσω του barrel `./index`) από κοινό κώδικα: ξαναγυρίζει
 *   όλος ο `dxf-viewer` σε κάθε σελίδα με καρτέλες (ADR-954 §2).
 */

import React, { type ComponentType } from 'react';

import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

import { FloorplanGalleryPendingFill, FloorplanGalleryPendingFlow } from './FloorplanGalleryPending';
import type { FloorplanGalleryProps } from './floorplan-gallery-props';

const FloorplanGallerySurfaces = defineLazySurfaces({
  /** Η κάτοψη σε καρτέλα αρχείων / σελίδα-έγγραφο (`layout: 'flow'`, η προεπιλογή). */
  FloorplanGallery: {
    load: () => import('@/components/shared/files/media/FloorplanGallery'),
    fallback: FloorplanGalleryPendingFlow,
  },
  /** Η κάτοψη στον θεατή μέσων (`layout: 'fill'`) — ίδιο chunk, άλλη όψη αναμονής. */
  FloorplanGalleryFill: {
    load: () => import('@/components/shared/files/media/FloorplanGallery'),
    fallback: FloorplanGalleryPendingFill,
  },
});

// Τα components με τα props τους — το εργοστάσιο δέχεται οποιοδήποτε component, εδώ ξαναδένεται ο τύπος.
const FlowFloorplanGallery: ComponentType<FloorplanGalleryProps> = FloorplanGallerySurfaces.FloorplanGallery;
const FillFloorplanGallery: ComponentType<FloorplanGalleryProps> = FloorplanGallerySurfaces.FloorplanGalleryFill;

/** Ο θεατής κατόψεων, φορτωμένος στη χρήση — ίδιο API με το `FloorplanGallery`. */
export function LazyFloorplanGallery(props: FloorplanGalleryProps): React.ReactElement {
  return props.layout === 'fill' ? <FillFloorplanGallery {...props} /> : <FlowFloorplanGallery {...props} />;
}
