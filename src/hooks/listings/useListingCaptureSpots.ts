'use client';

/**
 * @fileoverview 📍🧭 **Η αποτύπωση λήψης του γραφείου** — σημεία λήψης **και** βορράς κατόψεων, ατομικά (ADR-897).
 * @related ADR-897 · hooks/listings/useDeclaredFileIds (ο κοινός κύκλος ζωής) · lib/listings/capture-survey
 * @module hooks/listings/useListingCaptureSpots
 *
 * 🔑 **Κανένας νέος κύκλος ζωής** — αισιοδοξία, κλείδωμα, συμφιλίωση και επαναφορά είναι του
 * `usePropertyDeclarationPatch`. Εδώ γράφεται **ολόκληρη** η αποτύπωση με μία κίνηση, γιατί ο χώρος εργασίας κρατά
 * πρόχειρο και αποθηκεύει **μία** φορά — ποτέ γραφή ανά σύρσιμο.
 * 🔴 **Δύο πεδία, ΕΝΑ PATCH** (Φ5.2): σημεία και βορράς φεύγουν μαζί ή καθόλου — δες `capture-survey.ts`.
 */

import { useMemo } from 'react';

import { captureSurveyWire, readCaptureSurvey, sameCaptureSurvey, type CaptureSurvey } from '@/lib/listings/capture-survey';
import {
  usePropertyDeclarationPatch,
  type PropertyDeclarationPatch,
  type PropertyDeclarationState,
} from '@/hooks/listings/useDeclaredFileIds';

/** Σταθερό σε επίπεδο module — ο κωδικοποιητής δεν εξαρτάται από τίποτα της οθόνης. */
function captureSurveyPatch(survey: CaptureSurvey): PropertyDeclarationPatch {
  const wire = captureSurveyWire(survey);
  return { publishedPhotoCaptureSpots: wire.spots, publishedFloorplanNorth: wire.north };
}

export type ListingCaptureSurvey = PropertyDeclarationState<CaptureSurvey>;

export function useListingCaptureSurvey(
  propertyId: string,
  storedSpots: unknown,
  storedNorth: unknown,
): ListingCaptureSurvey {
  const stored = useMemo(() => readCaptureSurvey(storedSpots, storedNorth), [storedSpots, storedNorth]);
  return usePropertyDeclarationPatch(propertyId, stored, sameCaptureSurvey, captureSurveyPatch);
}
