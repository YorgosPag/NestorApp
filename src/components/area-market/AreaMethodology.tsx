'use client';

/**
 * **Πώς υπολογίζονται οι αριθμοί** — η μεθοδολογία ΠΑΝΩ στη σελίδα, όχι σε σύνδεσμο (ADR-890 Φ1).
 *
 * 🏆 Ο Redfin και το Idealista έχουν μεθοδολογία σε χωριστή σελίδα ή PDF, που δεν τη διαβάζει κανείς. Εδώ η ίδια
 * η σελίδα λέει: ζητούμενες (όχι συμβολαίου), διάμεσος (όχι μέσος όρος), το κατώφλι και από πού προέρχεται, τι
 * αποκλείεται και πόσο συχνά ξαναϋπολογίζεται.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MARKET_STAT_MIN_SAMPLE } from '@/lib/market/market-statistics';

const NS = 'area-market';
const CONTRACTS = 'market-contracts';
const CONTRACT_LINES = ['contract', 'comparable', 'zone', 'cadence'] as const;

export function AreaMethodology() {
  const { t } = useTranslation([NS, CONTRACTS]);
  return (
    <section aria-labelledby="area-method" className="flex flex-col gap-2 border-t border-border pt-4">
      <h2 id="area-method" className="m-0 text-lg font-semibold text-foreground">{t(`${NS}:method.title`)}</h2>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:method.asking`)}</p>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:method.median`)}</p>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:method.threshold`, { min: MARKET_STAT_MIN_SAMPLE })}</p>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:method.exclusions`)}</p>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:method.cadence`)}</p>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:method.trend`)}</p>
      {CONTRACT_LINES.map((line) => (
        <p key={line} className="m-0 text-sm text-muted-foreground">{t(`${CONTRACTS}:method.${line}`)}</p>
      ))}
    </section>
  );
}
