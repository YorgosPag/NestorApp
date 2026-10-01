'use client';

/**
 * @fileoverview **Το πρόχειρο του επεξεργαστή σημείων λήψης** — επιλογή, ενεργή κάτοψη, σημεία, βορράς (ADR-897 Φ3 · Φ5.2).
 * @related CaptureSpotWorkspaceDialog.tsx · lib/listings/photo-capture-spot-edit · lib/listings/capture-survey
 * @module components/listings/capture-spots/use-capture-spot-draft
 *
 * 🔑 **ΕΝΑ ΠΡΟΧΕΙΡΟ, ΜΙΑ ΑΠΟΘΗΚΕΥΣΗ** — όχι γραφή ανά σύρσιμο. Η δήλωση του γραφείου κλειδώνει όσο γράφεται
 *   (`usePropertyDeclarationPatch.saving`), άρα δύο γρήγορα συρσίματα θα έχαναν το δεύτερο **σιωπηλά**. Εδώ ο άνθρωπος
 *   τοποθετεί 20 φωτογραφίες, στρίβει τον βορρά δύο κατόψεων και πατά «Αποθήκευση» **μία** φορά ⇒ **ένα** PATCH με
 *   **όλα** τα πεδία (`CaptureSurvey`), μία επαναπροβολή, κανένας αγώνας (N.7.2 #2). «Ακύρωση» = τίποτα δεν άλλαξε.
 * ⚠️ Το πρόχειρο **γεννιέται σε κάθε άνοιγμα** (ο διάλογος αποσυνδέει το περιεχόμενό του όταν κλείνει).
 */

import { useCallback, useMemo, useState } from 'react';

import { normalizeAngleRad } from '@/lib/geometry/angle';
import { sameCaptureSurvey, type CaptureSurvey } from '@/lib/listings/capture-survey';
import { withDeclaredFileEntry } from '@/lib/listings/declared-file-map';
import { withDeclaredCaptureSpot, type PhotoCaptureSpot } from '@/lib/listings/photo-capture-spot';

export interface CaptureSpotDraft {
  /** Ολόκληρη η αποτύπωση — αυτό σώζεται, με μία πράξη. */
  readonly survey: CaptureSurvey;
  readonly spots: CaptureSurvey['spots'];
  readonly selectedPhotoId: string | null;
  readonly activeFloorplanId: string | null;
  /** Ο βορράς της **ενεργής** κάτοψης — `null` ⇒ δεν δηλώθηκε. */
  readonly activeNorthRad: number | null;
  /** Διαφέρει από τη δήλωση με την οποία άνοιξε ο διάλογος. */
  readonly dirty: boolean;
  readonly select: (photoId: string | null) => void;
  readonly activate: (floorplanId: string) => void;
  /** Αλλαγή του σημείου της **επιλεγμένης** φωτογραφίας· `null` ⇒ αφαίρεση θέσης. */
  readonly setSelected: (next: PhotoCaptureSpot | null) => void;
  /** Ο βορράς της **ενεργής** κάτοψης· `null` ⇒ αφαίρεση. */
  readonly setActiveNorth: (northRad: number | null) => void;
  readonly selectedSpot: PhotoCaptureSpot | null;
}

/** Η πρώτη κάτοψη που έχει ήδη σημεία — εκεί είναι η δουλειά του ανθρώπου· αλλιώς η πρώτη δηλωμένη. */
function initialFloorplan(spots: CaptureSurvey['spots'], floorplanIds: readonly string[]): string | null {
  const used = new Set([...spots.values()].map((spot) => spot.floorplanFileId));
  return floorplanIds.find((id) => used.has(id)) ?? floorplanIds[0] ?? null;
}

export function useCaptureSpotDraft(declared: CaptureSurvey, floorplanIds: readonly string[]): CaptureSpotDraft {
  const [survey, setSurvey] = useState(declared);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [activeFloorplanId, setActiveFloorplanId] = useState(() => initialFloorplan(declared.spots, floorplanIds));

  const select = useCallback((photoId: string | null) => {
    setSelectedPhotoId(photoId);
    // 🔑 Επιλογή φωτογραφίας τοποθετημένης σε **άλλη** κάτοψη ⇒ η οθόνη πάει εκεί (πρότυπο CubiCasa).
    const at = photoId === null ? undefined : survey.spots.get(photoId)?.floorplanFileId;
    if (at !== undefined && floorplanIds.includes(at)) setActiveFloorplanId(at);
  }, [survey.spots, floorplanIds]);

  const setSelected = useCallback((next: PhotoCaptureSpot | null) => {
    if (selectedPhotoId === null) return;
    setSurvey((current) => ({ ...current, spots: withDeclaredCaptureSpot(current.spots, selectedPhotoId, next) }));
  }, [selectedPhotoId]);

  const setActiveNorth = useCallback((northRad: number | null) => {
    if (activeFloorplanId === null) return;
    setSurvey((current) => ({
      ...current,
      north: withDeclaredFileEntry(current.north, activeFloorplanId, northRad === null ? null : normalizeAngleRad(northRad)),
    }));
  }, [activeFloorplanId]);

  const dirty = useMemo(() => !sameCaptureSurvey(survey, declared), [survey, declared]);

  return {
    survey,
    spots: survey.spots,
    selectedPhotoId,
    activeFloorplanId,
    activeNorthRad: activeFloorplanId === null ? null : survey.north.get(activeFloorplanId) ?? null,
    dirty,
    select,
    activate: setActiveFloorplanId,
    setSelected,
    setActiveNorth,
    selectedSpot: selectedPhotoId === null ? null : survey.spots.get(selectedPhotoId) ?? null,
  };
}
