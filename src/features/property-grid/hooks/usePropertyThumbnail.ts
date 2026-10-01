'use client';

/**
 * @fileoverview 📷 **Οι φωτογραφίες ενός ακινήτου του γραφείου** — κεφαλίδα, κάρτα πλέγματος (ADR-777 §8.30).
 * @related lib/properties/property-photos (η σειρά + το URL) · hooks/useAsyncData (ADR-223)
 * @module features/property-grid/hooks/usePropertyThumbnail
 *
 * 🔴 **Τρεις καταστάσεις, ποτέ σιωπή** (2026-10-01): το προηγούμενο hook έκανε `.catch(() => {})` και
 *   `files.find(f => f.downloadUrl)` — ένα σφάλμα ανάγνωσης και μια εγγραφή χωρίς `downloadUrl` έβγαζαν **το ίδιο**
 *   εικονίδιο-σπίτι, και κανείς δεν μπορούσε να καταλάβει ποιο από τα δύο συνέβη. Τώρα: `failed` + log για το
 *   πρώτο, URL από τον έναν αναγνώστη για το δεύτερο, και log για ό,τι μένει αδύνατο να δειχτεί.
 * 🔑 **Σειρά απαντήσεων και unmount ανήκουν στο `useAsyncData`** — κανένα δεύτερο `cancelled` flag.
 */

import { useEffect, useMemo } from 'react';

import { FILE_CATEGORIES } from '@/config/domain-constants';
import {
  propertyPhotosOf,
  type PropertyPhoto,
  type PropertyPhotoDeclarationSource,
} from '@/lib/properties/property-photos';
import { createModuleLogger } from '@/lib/telemetry';

import { usePropertyFileRecords } from './usePropertyFileRecords';

const logger = createModuleLogger('usePropertyPhotos');

export type PropertyPhotosState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly photos: readonly PropertyPhoto[] }
  | { readonly kind: 'failed' };

/** Το ακίνητο όπως το χρειάζεται το hook: ταυτότητα + τα ωμά πεδία δήλωσης. */
export interface PropertyPhotosSubject extends PropertyPhotoDeclarationSource {
  readonly id: string;
}

const LOADING: PropertyPhotosState = { kind: 'loading' };
const FAILED: PropertyPhotosState = { kind: 'failed' };

/** **Οι φωτογραφίες του ακινήτου**, με τη δηλωμένη σειρά (εξώφυλλο πρώτο). */
export function usePropertyPhotos(property: PropertyPhotosSubject): PropertyPhotosState {
  const propertyId = property.id;
  const files = usePropertyFileRecords({ propertyId, category: FILE_CATEGORIES.PHOTOS });

  const { publishedMediaOrder, publishedPhotoCaptureSpots } = property;
  const resolved = useMemo(
    () => (files.data === null ? null : propertyPhotosOf(files.data, { publishedMediaOrder, publishedPhotoCaptureSpots })),
    [files.data, publishedMediaOrder, publishedPhotoCaptureSpots],
  );

  const unavailable = resolved?.unavailable;
  useEffect(() => {
    if (unavailable !== undefined && unavailable.length > 0) {
      logger.warn('Φωτογραφίες ακινήτου που δεν μπορούν να δειχτούν', { propertyId, unavailable });
    }
  }, [unavailable, propertyId]);

  if (resolved !== null) return { kind: 'ready', photos: resolved.photos };
  return files.error === null ? LOADING : FAILED;
}

/** Η **πρώτη** φωτογραφία (το εξώφυλλο) — για την κάρτα πλέγματος. */
export function usePropertyThumbnail(property: PropertyPhotosSubject): string | undefined {
  const state = usePropertyPhotos(property);
  const cover = state.kind === 'ready' ? state.photos[0] : undefined;
  // Το παράγωγο, όχι το πρωτότυπο: μια κάρτα δεν κατεβάζει πια MB (ADR-899 §4).
  return cover?.preview?.src ?? cover?.url;
}
