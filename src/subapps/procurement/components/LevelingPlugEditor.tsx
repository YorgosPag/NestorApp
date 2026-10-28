'use client';

/**
 * Ο PM ορίζει **δικό του** ποσό για ένα κενό (εξαιρείται / χωρίς απάντηση) μιας προσφοράς — ADR-327 §8.5,
 * BuildingConnected «plug». Ξεκινά από την τρέχουσα κάλυψη (δική του ή αυτόματη) · η αυτόματη μένει ορατή
 * δίπλα, ώστε ο PM να βλέπει πόσο απέχει. «Επαναφορά» = πίσω στην αυτόματη.
 *
 * @module subapps/procurement/components/LevelingPlugEditor
 */

import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NumericField } from '@/components/ui/numeric-field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { getErrorMessage } from '@/lib/error-utils';
import type { LevelingCell, LevelingPlug } from '../types/bid-leveling';
import type { LevelingPlugChange } from '../utils/leveling-plugs';
import { useLevelingPlug } from '../hooks/useLevelingPlug';

/** Η αυτόματη κάλυψη: η ίδια η κάλυψη όταν δεν είναι του PM, αλλιώς αυτή που κρατά δίπλα του. */
function automaticOf(plug: LevelingPlug | null): LevelingPlug | null {
  if (!plug) return null;
  return plug.source === 'manual' ? plug.automatic ?? null : plug;
}

export function LevelingPlugEditor({ cell }: { cell: LevelingCell }) {
  const { t } = useTranslation('quotes');
  const [open, setOpen] = useState(false);
  const isManual = cell.plug?.source === 'manual';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]">
          <PencilLine className="mr-1 h-3 w-3" aria-hidden />
          {isManual ? t('comparison.leveling.plugEditor.edit') : t('comparison.leveling.plugEditor.set')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        {open && <PlugForm cell={cell} onDone={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

function PlugForm({ cell, onDone }: { cell: LevelingCell; onDone: () => void }) {
  const { t } = useTranslation('quotes');
  const { saving, save } = useLevelingPlug(cell.quoteId);
  const amountId = useId();
  const noteId = useId();
  const automatic = automaticOf(cell.plug);
  const [amount, setAmount] = useState(cell.plug?.amount ?? 0);
  const [note, setNote] = useState(cell.plug?.source === 'manual' ? cell.plug.note ?? '' : '');

  const submit = async (change: LevelingPlugChange) => {
    try {
      await save(change);
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, t('comparison.leveling.plugEditor.failed')));
    }
  };

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => { e.preventDefault(); void submit({ rfqLineId: cell.rfqLineId, amount, note }); }}
    >
      <Label htmlFor={amountId}>{t('comparison.leveling.plugEditor.amount')}</Label>
      <NumericField id={amountId} value={amount} onValueChange={setAmount} min={0} />
      <p className="text-[10px] text-muted-foreground">
        {automatic
          ? t('comparison.leveling.plugEditor.automatic', { amount: formatCurrency(automatic.amount) })
          : t('comparison.leveling.plugEditor.noAutomatic')}
      </p>
      <Label htmlFor={noteId}>{t('comparison.leveling.plugEditor.note')}</Label>
      <Textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
      <footer className="flex justify-end gap-2 pt-1">
        {cell.plug?.source === 'manual' && (
          <Button type="button" size="sm" variant="ghost" disabled={saving}
            onClick={() => void submit({ rfqLineId: cell.rfqLineId, amount: null, note: null })}>
            {t('comparison.leveling.plugEditor.reset')}
          </Button>
        )}
        <Button type="submit" size="sm" disabled={saving} aria-busy={saving}>
          {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />}
          {t('comparison.leveling.plugEditor.save')}
        </Button>
      </footer>
    </form>
  );
}
