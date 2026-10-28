'use client';

/**
 * Ό,τι απάντησε ο προμηθευτής **πέρα από τις γραμμές με τιμή** (ADR-327 §8.5): γραμμές RFQ που δήλωσε
 * «περιλαμβάνεται» / «εξαιρείται», και εναλλακτικές δεμένες στη γραμμή που αντικαθιστούν (εκτός συνόλου).
 * Χωρίς αυτό, μια προσφορά με εξαιρέσεις φαινόταν στην καρτέλα σαν πλήρης.
 *
 * @module subapps/procurement/components/QuoteRfqAnswers
 */

import { formatCurrency } from '@/lib/intl-formatting';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useUomLabel } from '@/hooks/useUomLabel';
import type { Quote, RfqScopeResponseKind } from '@/subapps/procurement/types/quote';

export function QuoteRfqAnswers({ quote }: { quote: Pick<Quote, 'scopeResponses' | 'alternates'> }) {
  const { t } = useTranslation('quotes');
  const uomLabel = useUomLabel();
  const responseText: Readonly<Record<RfqScopeResponseKind, string>> = {
    included: t('comparison.leveling.state.included'),
    excluded: t('comparison.leveling.state.excluded'),
  };
  const scope = quote.scopeResponses ?? [];
  const alternates = quote.alternates ?? [];
  if (scope.length === 0 && alternates.length === 0) return null;
  return (
    <section aria-label={t('quotes.rfqAnswers.title')} className="space-y-2 text-sm">
      {scope.length > 0 && (
        <ul className="divide-y rounded-md border">
          {scope.map((r) => (
            <li key={r.rfqLineId} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="flex-1">
                {r.description}
                {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
              </span>
              <span className={r.response === 'excluded' ? 'whitespace-nowrap text-[hsl(var(--text-warning))]' : 'whitespace-nowrap text-muted-foreground'}>
                {responseText[r.response]}
              </span>
            </li>
          ))}
        </ul>
      )}
      {alternates.length > 0 && (
        <>
          <h4 className="text-xs font-semibold text-muted-foreground">{t('quotes.rfqAnswers.alternatesTitle')}</h4>
          <ul className="divide-y rounded-md border border-dashed">
            {alternates.map((alt) => (
              <li key={alt.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex-1 truncate">{alt.description}</span>
                <span className="whitespace-nowrap text-muted-foreground">{alt.quantity} {uomLabel(alt.unit)}</span>
                <span className="whitespace-nowrap">{formatCurrency(alt.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
