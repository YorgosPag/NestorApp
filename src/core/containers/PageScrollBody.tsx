'use client';

/**
 * @fileoverview **ΤΟ ΣΩΜΑ ΣΕΛΙΔΑΣ ΠΟΥ ΚΥΛΑ**: ο μόνος scroll container κάτω από την κεφαλίδα ενός `PageContainer`.
 * @related ADR-927 §11 · core/containers/PageContainer.tsx · core/containers/FullscreenOverlay.tsx
 * @module core/containers/PageScrollBody
 *
 * 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ (μετρημένο στην παραγωγή 2026-11-03)**: το `PageContainer` είναι `overflow-hidden` και αφήνει
 *    την κύλιση «στα εσωτερικά components». Οι σελίδες λίστας έχουν `ListContainer`/`DetailsContainer`· οι σελίδες
 *    **ροής** (Ειδοποιήσεις, Ομάδες) δεν είχαν τίποτα. Η λίστα των 5.619px κοβόταν στην πρώτη οθόνη και το
 *    «Παλαιότερες» δεν φτανόταν ποτέ.
 *
 * Block (όχι flex) για τα παιδιά του: δεν τα συρρικνώνει ποτέ. Είναι το ίδιο μάθημα με το `FullscreenOverlay`
 * (ADR-332 D27 Ζ8), και γι' αυτό η κλάση είναι **μία**.
 */

import React from 'react';
import { cn } from '@/lib/utils';

/** Η κλάση του σώματος που κυλά — μία, για τη σελίδα και για την επιφάνεια πλήρους οθόνης. */
export const SCROLL_BODY_CLASS = 'min-h-0 flex-1 overflow-y-auto';

export interface PageScrollBodyProps {
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function PageScrollBody({ children, className }: PageScrollBodyProps) {
  return <section className={cn(SCROLL_BODY_CLASS, className)}>{children}</section>;
}
