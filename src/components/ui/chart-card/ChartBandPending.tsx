import React from 'react';

import { cn } from '@/lib/utils';

import { CHART_FIGURE_HEIGHT, type ChartCardFigureSize } from './figure-height';

const BLOCK = 'block animate-pulse rounded bg-muted';

/**
 * @enterprise ADR-710 — **Ο σκελετός ΜΙΑΣ ζώνης γραφήματος του κελύφους**: τίτλος (`ChartCardHeader`) · σχέδιο ·
 * (λεζάντα) · «Προβολή ως πίνακα». Το `loading` κάθε `next/dynamic` γραφήματος.
 *
 * 🔑 Ζει δίπλα στο `figure-height.ts` επειδή **είναι** η γεωμετρία του κελύφους: ένας σκελετός γραμμένος σε
 * κάθε καταναλωτή θα κρατούσε δεύτερο αντίγραφο των υψών και θα απέκλινε σιωπηλά (CLS). Γεννήθηκε ιδιωτικός
 * στο `owner-property-stats-pending.tsx` (ADR-777 §8.72.8) και εξήχθη με τον δεύτερο καταναλωτή (ADR-890 Φ2).
 */
export function ChartBandPending({ size, captioned = false }: { readonly size: ChartCardFigureSize; readonly captioned?: boolean }): React.ReactElement {
  return (
    <span aria-hidden className="flex flex-col">
      <span className={cn(BLOCK, 'mb-4 h-7 w-40')} />
      <span className={cn(BLOCK, 'rounded-md', CHART_FIGURE_HEIGHT[size])} />
      {captioned && <span className={cn(BLOCK, 'mt-2 h-10')} />}
      <span className={cn(BLOCK, 'mt-4 h-5 w-44')} />
    </span>
  );
}
