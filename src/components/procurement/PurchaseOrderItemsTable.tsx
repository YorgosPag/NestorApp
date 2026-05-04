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
import type { Material } from '@/subapps/procurement/types/material';

const MATERIAL_NONE = '__none__';

interface FormItem {
  tempId: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  boqItemId: string | null;
  categoryCode: string;
  materialId: string | null;
}

interface PurchaseOrderItemsTableProps {
  items: FormItem[];
  onUpdateItem: (tempId: string, updates: Partial<FormItem>) => void;
  onAddItem: () => void;
  onRemoveItem: (tempId: string) => void;
  materials?: Material[];
  readOnly?: boolean;
}

export function PurchaseOrderItemsTable({
  items,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
  materials = [],
  readOnly = false,
}: PurchaseOrderItemsTableProps) {
  const { t } = useTranslation('procurement');

  const materialsForCategory = (categoryCode: string) =>
    materials.filter((m) => m.atoeCategoryCode === categoryCode);

  const handleMaterialSelect = (tempId: string, materialId: string | null) => {
    const item = items.find((i) => i.tempId === tempId);
    if (!item) return;
    const updates: Partial<FormItem> = { materialId };
    if (materialId) {
      const mat = materials.find((m) => m.id === materialId);
      if (mat) {
        if (!item.description) updates.description = mat.name;
        if (item.unit === 'τεμ' && mat.unit) updates.unit = mat.unit;
        if (!item.unitPrice || item.unitPrice === 0) {
          const price = mat.lastPrice ?? mat.avgPrice;
          if (price != null) updates.unitPrice = price;
        }
      }
    }
    onUpdateItem(tempId, updates);
  };

  return (
    <div className="space-y-3">
      {/* Desktop: Table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px] w-[220px]">{t('items.category')} <span className="text-destructive">*</span></TableHead>
              <TableHead className="min-w-[200px]">
                {t('items.description')} <span className="text-destructive">*</span>
                {materials.length > 0 && !readOnly && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/ {t('items.materialColumn')}</span>
                )}
              </TableHead>
              <TableHead className="w-[100px]">{t('items.quantity')}</TableHead>
              <TableHead className="w-[100px]">{t('items.unit')}</TableHead>
              <TableHead className="w-[120px]">{t('items.unitPrice')}</TableHead>
              <TableHead className="w-[120px]">{t('items.total')}</TableHead>
              {!readOnly && <TableHead className="w-[50px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.tempId}>
                <TableCell className="min-w-[220px] w-[220px]">
                  <Select
                    value={item.categoryCode}
                    onValueChange={(v) =>
                      onUpdateItem(item.tempId, { categoryCode: v })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('contributionTypePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent className="min-w-[260px]">
                      {ATOE_MASTER_CATEGORIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} — {t(`categories.${c.code}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {materials.length > 0 && !readOnly && (
                    <Select
                      value={item.materialId ?? MATERIAL_NONE}
                      onValueChange={(v) =>
                        handleMaterialSelect(item.tempId, v === MATERIAL_NONE ? null : v)
                      }
                    >
                      <SelectTrigger className="mb-1 h-7 text-xs text-muted-foreground">
                        <SelectValue placeholder={t('items.materialOptional')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MATERIAL_NONE}>—</SelectItem>
                        {materialsForCategory(item.categoryCode).map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.code} — {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {t('items.category')} <span className="text-destructive">*</span>
              </p>
              <Select
                value={item.categoryCode}
                onValueChange={(v) =>
                  onUpdateItem(item.tempId, { categoryCode: v })
                }
                disabled={readOnly}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('contributionTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent className="min-w-[260px]">
                  {ATOE_MASTER_CATEGORIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {t(`categories.${c.code}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {materials.length > 0 && !readOnly && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('items.materialOptional')}</p>
                <Select
                  value={item.materialId ?? MATERIAL_NONE}
                  onValueChange={(v) =>
                    handleMaterialSelect(item.tempId, v === MATERIAL_NONE ? null : v)
                  }
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MATERIAL_NONE}>—</SelectItem>
                    {materialsForCategory(item.categoryCode).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.code} — {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {t('items.description')} <span className="text-destructive">*</span>
              </p>
              <Input
                value={item.description}
                onChange={(e) =>
                  onUpdateItem(item.tempId, { description: e.target.value })
                }
                placeholder={t('items.descriptionShort')}
                disabled={readOnly}
              />
            </div>
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
            <div className="flex items-center justify-end">
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
