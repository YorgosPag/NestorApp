'use client';
/**
 * **Πληρότητα ανά κανάλι × γλώσσα** — ζωντανά, όσο γράφεις (ADR-923 §5.10 Δ5/Δ7, §5.10.4 Β3).
 *
 * Κάθε «λείπει» είναι **σύνδεσμος** στο πεδίο (αλλάζει καρτέλα + κανάλι × γλώσσα και εστιάζει — Akeneo). 🏆 Πέρα από
 * τους μεγάλους: το «Άγνωστο» (δηλωμένο, ETIM `UN`) εξηγείται **χωριστά** από το «κενό» — είναι ελλιπές **με αιτία**,
 * όχι παράλειψη· και το «Δεν εφαρμόζεται» μετρά πλήρες (Δ5).
 *
 * @module components/catalog/products/editor/CompletenessPanel
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HUMAN_LANGUAGES, type HumanLanguage } from '@/i18n/languages';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { completenessPercent, type CompletenessMatrix } from '@/subapps/catalog/completeness/compute-completeness';
import type { CatalogCompletenessSummary } from '@/subapps/catalog/types/product-derived';
import { CATALOG_CHANNELS, type CatalogChannel } from '@/subapps/catalog/vocabulary/channels';

import { CHANNEL_KEYS, LANGUAGE_KEYS } from '../../shared/catalog-labels';
import { useCatalogText } from '../../shared/catalog-ui-hooks';

export interface CompletenessPanelProps {
  readonly matrix: CompletenessMatrix;
  readonly attributeById: ReadonlyMap<string, AttributeRecord>;
  readonly onJump: (attributeId: string, channel: CatalogChannel, locale: HumanLanguage) => void;
  /** Μόνο για μοντέλα: «x/y πλήρεις παραλλαγές» ανά κανάλι × γλώσσα (`derived.summary` της ρίζας). */
  readonly variantSummary?: CatalogCompletenessSummary | null;
}

function Cell({ channel, locale, props }: { readonly channel: CatalogChannel; readonly locale: HumanLanguage; readonly props: CompletenessPanelProps }) {
  const { t, text } = useCatalogText();
  const cell = props.matrix[channel][locale];
  if (!cell) return null;
  const percent = completenessPercent(cell);
  const variant = percent >= 100 ? 'success' : percent > 0 ? 'warning' : 'destructive';
  return (
    <li className="grid gap-1 rounded-md border border-border p-3">
      <span className="flex items-center justify-between gap-2 text-sm font-medium">
        {`${t(CHANNEL_KEYS[channel])} · ${t(LANGUAGE_KEYS[locale])}`}
        <Badge variant={variant}>{t('completeness.cell', { filled: cell.filled, required: cell.required, percent })}</Badge>
      </span>
      {props.variantSummary?.[channel]?.[locale] ? (
        <span className="text-xs text-muted-foreground">{t('completeness.variants', props.variantSummary[channel][locale] ?? { complete: 0, total: 0 })}</span>
      ) : null}
      {cell.missing.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
          {cell.missing.map((gap) => {
            const attribute = props.attributeById.get(gap.attributeId);
            const name = attribute ? text(attribute.labels, attribute.code) : gap.attributeId;
            return (
              <li key={gap.attributeId}>
                <Button type="button" variant="outline" size="sm" onClick={() => props.onJump(gap.attributeId, channel, locale)}>
                  {gap.cause === 'unknown' ? t('completeness.missingUnknown', { name }) : name}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

export function CompletenessPanel(props: CompletenessPanelProps) {
  const { t } = useCatalogText();
  const hasUnknown = CATALOG_CHANNELS.some((channel) => Object.values(props.matrix[channel]).some((cell) => cell?.missing.some((gap) => gap.cause === 'unknown')));
  return (
    <section className="grid gap-2" aria-labelledby="completeness-title">
      <h3 id="completeness-title" className="m-0 text-sm font-semibold">{t('completeness.title')}</h3>
      {props.variantSummary ? <p className="m-0 text-xs text-muted-foreground">{t('completeness.levelExplained')}</p> : null}
      <ul className="m-0 grid list-none gap-2 p-0">
        {CATALOG_CHANNELS.flatMap((channel) => HUMAN_LANGUAGES.filter((locale) => props.matrix[channel][locale] !== undefined).map((locale) => (
          <Cell key={`${channel}:${locale}`} channel={channel} locale={locale} props={props} />
        )))}
      </ul>
      {hasUnknown ? <p className="m-0 text-xs text-muted-foreground">{t('completeness.unknownExplained')}</p> : null}
      <p className="m-0 text-xs text-muted-foreground">{t('completeness.notApplicableExplained')}</p>
    </section>
  );
}
