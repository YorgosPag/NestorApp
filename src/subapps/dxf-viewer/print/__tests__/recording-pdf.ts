/**
 * Πλαστό jsPDF που **καταγράφει** κάθε κλήση (ADR-909 Γ2.7) — ο αδελφός του `recording-canvas.ts` για τον δρόμο
 * του vector PDF, όπου δεν υπάρχει καμβάς να καταγραφεί.
 *
 * Όχι αρχείο test: βοήθημα. Κάθε μέθοδος που **δεν** δηλώνεται εδώ καταγράφεται μόνη της (Proxy), ώστε ένας
 * νέος κλάδος του emitter που καλεί κάτι καινούργιο να **μετριέται** αντί να σκάει με `not a function`.
 * Τα πραγματικά μαθηματικά των tiling patterns επικυρώνονται με αληθινό jsPDF στο `pdf-tiling-pattern.test.ts`.
 */

import type { jsPDF } from 'jspdf';

export interface PdfCall {
  readonly fn: string;
  readonly args: readonly unknown[];
}

/** Ένα χρώμα που τέθηκε στην κατάσταση του PDF: γραμμής (`setDrawColor`) ή γεμίσματος (`setFillColor`). */
export interface PdfInk {
  readonly fn: 'setDrawColor' | 'setFillColor';
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

function matrix(...m: number[]): Record<string, unknown> {
  return {
    a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5],
    multiply: () => matrix(...m),
    toString: () => m.join(' '),
  };
}

export function recordingPdf(): { pdf: jsPDF; calls: PdfCall[] } {
  const calls: PdfCall[] = [];
  const fixed: Record<string, unknown> = {
    internal: { scaleFactor: 72 / 25.4, pageSize: { getHeight: () => 297 } },
    Matrix: (...m: number[]) => matrix(...m),
    TilingPattern: () => ({ cloneIndex: 0 }),
    GState: (state: unknown) => state,
    advancedAPI: (body: () => void) => { calls.push({ fn: 'advancedAPI', args: [] }); body(); },
  };
  const pdf = new Proxy(fixed, {
    get: (target, prop) => {
      if (typeof prop !== 'string') return undefined;
      if (prop in target) return target[prop];
      return (...args: unknown[]) => { calls.push({ fn: prop, args }); };
    },
  });
  return { pdf: pdf as unknown as jsPDF, calls };
}

/** Κάθε χρώμα γραμμής / γεμίσματος που τέθηκε, με τη σειρά. */
export function inkOf(calls: readonly PdfCall[]): PdfInk[] {
  const inks: PdfInk[] = [];
  for (const call of calls) {
    if (call.fn !== 'setDrawColor' && call.fn !== 'setFillColor') continue;
    const [r, g, b] = call.args as number[];
    inks.push({ fn: call.fn, r, g, b });
  }
  return inks;
}

export const isAchromatic = (ink: PdfInk): boolean => ink.r === ink.g && ink.g === ink.b;
