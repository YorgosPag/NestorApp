'use client';

/**
 * @fileoverview 🎯 **Τα σημεία εστίασης του γραφείου** — η τρίτη δήλωση του ακινήτου (ADR-880).
 * @related ADR-880 · hooks/listings/useDeclaredFileIds (ο κοινός κύκλος ζωής) · lib/listings/photo-focal-point
 * @module hooks/listings/useListingFocalPoints
 *
 * 🔑 **Κανένας νέος κύκλος ζωής**: αισιοδοξία, κλείδωμα, συμφιλίωση και επαναφορά είναι του
 * `usePropertyDeclaration`. Εδώ ζει μόνο ό,τι είναι **δικό** αυτής της δήλωσης: χάρτης `fileId → σημείο`,
 * και ότι το `null` **αφαιρεί** τη γραμμή (επιστροφή στο αυτόματο).
 */

import { useCallback } from 'react';

import {
  readDeclaredFocalPoints,
  sameDeclaredFocalPoints,
  withDeclaredFocalPoint,
  type PhotoFocalPoint,
} from '@/lib/listings/photo-focal-point';
import {
  usePropertyDeclaration,
  type PropertyDeclarationCodec,
  type PropertyDeclarationState,
} from '@/hooks/listings/useDeclaredFileIds';

type FocalPointMap = ReadonlyMap<string, PhotoFocalPoint>;

/** Σταθερό σε επίπεδο module — ο κωδικοποιητής δεν εξαρτάται από τίποτα της οθόνης. */
const FOCAL_POINTS_CODEC: PropertyDeclarationCodec<FocalPointMap> = {
  read: readDeclaredFocalPoints,
  equals: sameDeclaredFocalPoints,
  toWire: (value) => Object.fromEntries(value),
};

export interface ListingFocalPoints extends Pick<PropertyDeclarationState<FocalPointMap>, 'saving' | 'failed'> {
  readonly pointOf: (fileId: string) => PhotoFocalPoint | null;
  readonly setPoint: (fileId: string, point: PhotoFocalPoint | null) => Promise<void>;
}

export function useListingFocalPoints(propertyId: string, storedValue: unknown): ListingFocalPoints {
  const { declared, saving, failed, commit } = usePropertyDeclaration(
    propertyId,
    'publishedMediaFocalPoints',
    storedValue,
    FOCAL_POINTS_CODEC,
  );

  const pointOf = useCallback((fileId: string) => declared.get(fileId) ?? null, [declared]);
  const setPoint = useCallback(
    (fileId: string, point: PhotoFocalPoint | null) => commit(withDeclaredFocalPoint(declared, fileId, point)),
    [commit, declared],
  );

  return { pointOf, setPoint, saving, failed };
}
