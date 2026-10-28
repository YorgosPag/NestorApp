'use client';

/**
 * **Δέσιμο γραμμών σαρωμένης/χειροκίνητης προσφοράς στις γραμμές του RFQ** (ADR-327 §8.5) — ο PM βλέπει την πρόταση
 * (`proposeRfqLineBindings`: κωδικός ΑΤΟΕ → περιγραφή, μόνο μοναδικό ταίριασμα) και την αποδέχεται ή τη διορθώνει.
 *
 * Τίποτα δεν γράφεται σιωπηλά: η πρόταση φαίνεται ως «πρόταση» μέχρι να την αποδεχτεί ο PM («Αποδοχή προτάσεων» ή
 * επιλογή σε γραμμή). Τότε γράφονται **όλες** οι γραμμές μαζί (δεμένη ή πρόσθετη) — η προσφορά γίνεται ρητά δεμένη και
 * ο κινητήρας leveling σταματά να μαντεύει. Η αποθήκευση είναι του γονέα — η ετικέτα του κουμπιού του έρχεται ως `saveActionLabel`.
 *
 * @module subapps/procurement/components/QuoteRfqBindingReview
 */

import { useMemo } from 'react';
import { Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { QuoteLine } from '../types/quote';
import { toPublicRfqLine, type PublicRfqLine } from '../types/rfq-line';
import { useRfqLines } from '../hooks/useRfqLines';
import { proposeRfqLineBindings, type RfqBindingProposal } from '../utils/rfq-line-binding';

/** Radix Select δεσμεύει το `''` (CHECK 3.48) — η «πρόσθετη γραμμή» έχει δικό της φρουρό. */
const ADDITIONAL = '__additional__';

interface Props {
  rfqId: string;
  lines: QuoteLine[];
  onChange: (lines: QuoteLine[]) => void;
  /** Η ετικέτα του κουμπιού που ΓΡΑΦΕΙ το δέσιμο σε αυτή την επιφάνεια («Επιβεβαίωση» σάρωσης · «Αποθήκευση» φόρμας). */
  saveActionLabel: string;
}

/** Γράφει ΟΛΕΣ τις γραμμές: την επιλογή του PM όπου υπάρχει, αλλιώς την πρόταση (ή πρόσθετη). */
function applyBindings(lines: QuoteLine[], proposals: readonly RfqBindingProposal[], override?: { lineId: string; rfqLineId: string | null }) {
  const chosen = new Map(proposals.map((p) => [p.lineId, p.rfqLineId] as const));
  if (override) chosen.set(override.lineId, override.rfqLineId);
  return lines.map((line) => ({ ...line, rfqLineId: chosen.get(line.id) ?? null }));
}

export function QuoteRfqBindingReview({ rfqId, lines, onChange, saveActionLabel }: Props) {
  const { t } = useTranslation('quotes');
  const { lines: rfqRecords } = useRfqLines(rfqId);
  const rfqLines = useMemo(() => rfqRecords.map(toPublicRfqLine), [rfqRecords]);
  const proposals = useMemo(() => proposeRfqLineBindings(lines, rfqLines), [lines, rfqLines]);
  if (rfqLines.length === 0 || lines.length === 0) return null;
  const hasSuggestions = proposals.some((p) => p.origin === 'suggested');
  const select = (lineId: string, value: string) =>
    onChange(applyBindings(lines, proposals, { lineId, rfqLineId: value === ADDITIONAL ? null : value }));

  return (
    <section className="space-y-2 rounded-md border border-border p-3" aria-labelledby={`binding-${rfqId}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`binding-${rfqId}`} className="flex items-center gap-1.5 text-sm font-semibold">
          <Link2 className="h-4 w-4" aria-hidden />
          {t('quotes.binding.title')}
        </h3>
        {hasSuggestions && (
          <Button size="sm" variant="outline" onClick={() => onChange(applyBindings(lines, proposals))}>
            {t('quotes.binding.acceptAll')}
          </Button>
        )}
      </header>
      <p className="text-xs text-muted-foreground">{t('quotes.binding.hintAction', { action: saveActionLabel })}</p>
      <ul className="divide-y divide-border">
        {lines.map((line, index) => (
          <BindingRow
            key={line.id}
            line={line}
            proposal={proposals[index]}
            rfqLines={rfqLines}
            takenByOthers={new Set(proposals.filter((p, i) => i !== index && p.rfqLineId).map((p) => p.rfqLineId as string))}
            onSelect={(value) => select(line.id, value)}
          />
        ))}
      </ul>
    </section>
  );
}

function BindingRow({ line, proposal, rfqLines, takenByOthers, onSelect }: {
  line: QuoteLine;
  proposal: RfqBindingProposal;
  rfqLines: readonly PublicRfqLine[];
  takenByOthers: ReadonlySet<string>;
  onSelect: (value: string) => void;
}) {
  const { t } = useTranslation('quotes');
  return (
    <li className="grid grid-cols-1 items-center gap-2 py-2 sm:grid-cols-2">
      <p className="truncate text-sm">{line.description}</p>
      <span className="flex items-center gap-2">
        <Select value={proposal.rfqLineId ?? ADDITIONAL} onValueChange={onSelect}>
          <SelectTrigger aria-label={t('quotes.binding.selectLabel', { description: line.description })} className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ADDITIONAL}>{t('quotes.binding.additional')}</SelectItem>
            <SelectSeparator />
            {rfqLines.map((r) => (
              <SelectItem key={r.id} value={r.id} disabled={takenByOthers.has(r.id)}>{r.description}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {proposal.origin === 'suggested' && <Badge variant="outline" className="shrink-0 text-[10px]">{t('quotes.binding.suggested')}</Badge>}
      </span>
    </li>
  );
}
