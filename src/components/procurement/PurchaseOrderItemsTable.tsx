'use client';

/**
 * PurchaseOrderItemsTable — Line items editor for PO form
 *
 * Features:
 * - Add/remove items
 * - ΑΤΟΕ category dropdown
 * - Unit dropdown (from procurement-units config)
 * - Auto-calculated total per line
 * - Responsive: table on desktop, cards on mobile
 *
 * @see ADR-267 §4.1 (Line Items)
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/design-system';
import { Plus, Trash2 } from 'lucide-react';
import { PROCUREMENT_UNIT_OPTIONS } from '@/config/procurement-units';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface FormItem {
  tempId: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  boqItemId: string | null;
  categoryCode: string;
}

interface PurchaseOrderItemsTableProps {
  items: FormItem[];
  onUpdateItem: (tempId: string, updates: Partial<FormItem>) => void;
  onAddItem: () => void;
  onRemoveItem: (tempId: string) => void;
  readOnly?: boolean;
}

/** ΑΤΟΕ category codes — labels from i18n */
const ATOE_CODES = [
  'OIK-1', 'OIK-2', 'OIK-3', 'OIK-4', 'OIK-5', 'OIK-6',
  'OIK-7', 'OIK-8', 'OIK-9', 'OIK-10', 'OIK-11', 'OIK-12',
] as const;

export function PurchaseOrderItemsTable({
  items,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
  readOnly = false,
}: PurchaseOrderItemsTableProps) {
  const { t } = useTranslation('procurement');

  return (
    <div className="space-y-3">
      {/* Desktop: Table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">{t('items.description')}</TableHead>
              <TableHead className="w-[100px]">{t('items.quantity')}</TableHead>
              <TableHead className="w-[100px]">{t('items.unit')}</TableHead>
              <TableHead className="w-[120px]">{t('items.unitPrice')}</TableHead>
              <TableHead className="w-[120px]">{t('items.total')}</TableHead>
              <TableHead className="w-[140px]">{t('items.category')}</TableHead>
              {!readOnly && <TableHead className="w-[50px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.tempId}>
                <TableCell>
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      onUpdateItem(item.tempId, { description: e.target.value })
                    }
                    placeholder={t('items.descriptionPlaceholder')}
                    disabled={readOnly}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    value={item.quantity || ''}
                    onChange={(e) =>
                      onUpdateItem(item.tempId, {
                        quantity: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={readOnly}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={item.unit}
                    onValueChange={(v) => onUpdateItem(item.tempId, { unit: v })}
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCUREMENT_UNIT_OPTIONS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label.el}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unitPrice || ''}
                    onChange={(e) =>
                      onUpdateItem(item.tempId, {
                        unitPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={readOnly}
                  />
                </TableCell>
                <TableCell>
                  <span className="tabular-nums font-medium">
                    €{(item.quantity * item.unitPrice).toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>
                  <Select
                    value={item.categoryCode}
                    onValueChange={(v) =>
                      onUpdateItem(item.tempId, { categoryCode: v })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="ΑΤΟΕ" />
                    </SelectTrigger>
                    <SelectContent>
                      {ATOE_CODES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code} — {t(`categories.${code}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveItem(item.tempId)}
                      disabled={items.length <= 1}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {items.map((item, idx) => (
          <article
            key={item.tempId}
            className={cn(
              'rounded-lg border p-3 space-y-2',
              'bg-card'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                #{idx + 1}
              </span>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveItem(item.tempId)}
                  disabled={items.length <= 1}
                  className="h-7 w-7 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <Input
              value={item.description}
              onChange={(e) =>
                onUpdateItem(item.tempId, { description: e.target.value })
              }
              placeholder={t('items.descriptionShort')}
              disabled={readOnly}
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                min={0}
                value={item.quantity || ''}
                onChange={(e) =>
                  onUpdateItem(item.tempId, {
                    quantity: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder={t('items.quantityShort')}
                disabled={readOnly}
              />
              <Select
                value={item.unit}
                onValueChange={(v) => onUpdateItem(item.tempId, { unit: v })}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROCUREMENT_UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label.el}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={item.unitPrice || ''}
                onChange={(e) =>
                  onUpdateItem(item.tempId, {
                    unitPrice: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder={t('items.unitPriceShort')}
                disabled={readOnly}
              />
            </div>
            <div className="flex items-center justify-between">
              <Select
                value={item.categoryCode}
                onValueChange={(v) =>
                  onUpdateItem(item.tempId, { categoryCode: v })
                }
                disabled={readOnly}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="ΑΤΟΕ" />
                </SelectTrigger>
                <SelectContent>
                  {ATOE_MASTER_CATEGORIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.nameEL}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="font-semibold tabular-nums">
                €{(item.quantity * item.unitPrice).toFixed(2)}
              </span>
            </div>
          </article>
        ))}
      </div>

      {!readOnly && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAddItem}
          className="w-full md:w-auto"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('items.addItem')}
        </Button>
      )}
    </div>
  );
}
