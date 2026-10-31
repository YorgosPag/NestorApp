'use client';

/**
 * @fileoverview **Ο κωδικός QR της ζωντανής βιτρίνας** — μία γέννηση για τις δύο οθόνες (ADR-841 §7 Α21.17).
 * @related components/mandate/ShowcaseShareDialog.tsx (δημόσια) · components/mandate/ShowcaseQrPanel.tsx (ρυθμίσεις) ·
 *   lib/qr/qr-code.ts
 * @module hooks/mandate/useShowcaseQr
 *
 * 🔑 **Δείχνει στη ΖΩΝΤΑΝΗ σελίδα, ποτέ σε ενσωματωμένα στοιχεία** (όχι vCard-μέσα-στο-QR): αλλαγή τηλεφώνου ή
 * ωραρίου ⇒ τίποτα για επανεκτύπωση. Και **καμία παράμετρος παρακολούθησης** (`utm_*`) — αρχή #2 της Α21.16.
 *
 * 🔑 Η γέννηση ζει στο `useQrSvg`: εδώ μένει μόνο **ποια** σελίδα.
 */

import { agencyProfileRoute } from '@/components/mandate/agency-directory-route';
import { useQrSvg, type QrSvgState } from '@/hooks/useQrSvg';
import type { QrPreset } from '@/lib/qr/qr-code';

export type ShowcaseQrState = QrSvgState;

export function useShowcaseQr(alias: string, preset: QrPreset): ShowcaseQrState {
  return useQrSvg(agencyProfileRoute(alias), preset);
}

/** **SVG → `src` εικόνας** — `<img>` αντί για `dangerouslySetInnerHTML`: το SVG δεν γίνεται ποτέ DOM της σελίδας. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
