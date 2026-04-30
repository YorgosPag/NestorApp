'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TradeSelector } from './TradeSelector';
import { getAtoeCodesForTrade } from '@/subapps/procurement/data/trades';
import { UNITS, OTHER_UNIT } from '@/subapps/procurement/utils/units';
import type { RfqLine, CreateRfqLineDTO } from '@/subapps/procurement/types/rfq-line';
import type { TradeCode } from '@/subapps/procurement/types/trade';
import type { SetupLockState } from '@/subapps/procurement/utils/rfq-lock-state';

// ============================================================================
// TYPES
// ============================================================================

interface RfqLinesPanelProps {
  rfqId: string;
  lines: RfqLine[];
  loading: boolean;
  onAdd: (dto: CreateRfqLineDTO) => Promise<RfqLine>;
  onDelete: (lineId: string) => Promise<void>;
  lockState?: SetupLockState;
}

interface NewLineState {
  description: string;
  trade: TradeCode;
  quantity: string;
  unit: string;
  customUnit: boolean;
}

const DEFAULT_TRADE: TradeCode = 'concrete';

const EMPTY_LINE: NewLineState = {
  description: '',
  trade: DEFAULT_TRADE,
  quantity: '',
  unit: UNITS[0],
  customUnit: false,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function RfqLinesPanel({ lines, loading, onAdd, onDelete, lockState = 'unlocked' }: RfqLinesPanelProps) {
  const locked = lockState !== 'unlocked';
  const { t } = useTranslation('quotes');
  const [showForm, setShowForm] = useState(false);
  const [newLine, setNewLine] = useState<NewLineState>(EMPTY_LINE);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newLine.description.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      const defaultCategoryCode = getAtoeCodesForTrade(newLine.trade)[0] ?? null;
      const resolvedUnit = newLine.customUnit ? newLine.unit.trim() || null : newLine.unit || null;
      const dto: CreateRfqLineDTO = {
        source: 'ad_hoc',
        description: newLine.description.trim(),
        trade: newLine.trade,
        categoryCode: defaultCategoryCode,
        quantity: newLine.quantity ? parseFloat(newLine.quantity) : null,
        unit: resolvedUnit,
      };
      await onAdd(dto);
      setNewLine(EMPTY_LINE);
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lineId: string) => {
    setDeleting(lineId);
    try {
      await onDelete(lineId);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('rfqs.loading')}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      {lines.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">{t('rfqs.linesEmpty')}</p>
      )}

      {lines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineDescription')}</th>
                <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineTrade')}</th>
                <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineQuantity')}</th>
                <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineUnit')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="py-1.5 pr-2">{line.description}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{line.trade}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{line.quantity ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{line.unit ?? '—'}</td>
                  <td className="py-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={deleting === line.id || locked}
                      onClick={() => handleDelete(line.id)}
                    >
                      {deleting === line.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      }
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-4">
          <Input
            placeholder={t('rfqs.lineDescription')}
            value={newLine.description}
            onChange={(e) => setNewLine((p) => ({ ...p, description: e.target.value }))}
            className="sm:col-span-2"
          />
          <TradeSelector
            value={newLine.trade}
            onChange={(trade) => setNewLine((p) => ({ ...p, trade }))}
          />
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={t('rfqs.lineQuantity')}
              value={newLine.quantity}
              onChange={(e) => setNewLine((p) => ({ ...p, quantity: e.target.value }))}
              className="w-20"
              min={0}
            />
            <div className="flex flex-col gap-1">
              <Select
                value={newLine.customUnit ? OTHER_UNIT : newLine.unit}
                onValueChange={(val) => {
                  if (val === OTHER_UNIT) {
                    setNewLine((p) => ({ ...p, customUnit: true, unit: '' }));
                  } else {
                    setNewLine((p) => ({ ...p, customUnit: false, unit: val }));
                  }
                }}
              >
                <SelectTrigger className="h-9 w-24 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  <SelectSeparator />
                  <SelectItem value={OTHER_UNIT}>{t('rfqs.lineEdit.unitOption.other')}</SelectItem>
                </SelectContent>
              </Select>
              {newLine.customUnit && (
                <Input
                  placeholder={t('rfqs.lineEdit.unitOption.otherPlaceholder')}
                  value={newLine.unit}
                  onChange={(e) => setNewLine((p) => ({ ...p, unit: e.target.value }))}
                  className="h-7 w-24 text-xs"
                />
              )}
            </div>
          </div>
          {formError && <p className="col-span-full text-xs text-destructive">{formError}</p>}
          <div className="col-span-full flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving || !newLine.description.trim()}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              {t('rfqs.submit')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setNewLine(EMPTY_LINE); }}>
              {t('rfqs.cancel')}
            </Button>
          </div>
        </div>
      )}

      {!showForm && (
        <Button size="sm" variant="outline" disabled={locked} onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('rfqs.addLine')}
        </Button>
      )}
    </section>
  );
}
