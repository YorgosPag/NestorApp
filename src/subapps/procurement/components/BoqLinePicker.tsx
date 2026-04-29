'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BOQItem } from '@/types/boq/boq';

// ============================================================================
// TYPES
// ============================================================================

type PickedBoqItem = Pick<BOQItem, 'id' | 'title' | 'categoryCode' | 'estimatedQuantity' | 'unit' | 'description'>;

interface BoqLinePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSelect: (items: PickedBoqItem[]) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BoqLinePicker({ open, onOpenChange, projectId, onSelect }: BoqLinePickerProps) {
  const { t } = useTranslation('quotes');
  const [items, setItems] = useState<PickedBoqItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !projectId) return;
    setItems([]);
    setSelected(new Set());
    setSearch('');
    setLoading(true);

    fetch(`/api/boq/items?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => setItems(json.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const filtered = search.trim()
    ? items.filter(
        (item) =>
          item.title.toLowerCase().includes(search.toLowerCase()) ||
          item.categoryCode.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleAdd = () => {
    const picked = items.filter((item) => selected.has(item.id));
    onSelect(picked);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('rfqs.boqPicker.title')}</DialogTitle>
        </DialogHeader>

        <Input
          placeholder={t('rfqs.boqPicker.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />

        <div className="max-h-72 overflow-y-auto space-y-1">
          {loading && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t('rfqs.boqPicker.loading')}
            </p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t('rfqs.boqPicker.empty')}
            </p>
          )}
          {filtered.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <Checkbox
                checked={selected.has(item.id)}
                onCheckedChange={() => toggle(item.id)}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.categoryCode}
                  {item.estimatedQuantity != null && (
                    <> &middot; {item.estimatedQuantity} {item.unit}</>
                  )}
                </p>
              </div>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('rfqs.cancel')}
          </Button>
          <Button onClick={handleAdd} disabled={selected.size === 0}>
            {t('rfqs.boqPicker.add', { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
