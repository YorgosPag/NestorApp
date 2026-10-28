'use client';

/**
 * PurchaseOrderItemsTable — Line items editor for PO form
 *
 * Features:
 * - Add/remove items
 * - ΑΤΟΕ category dropdown
 * - Unit dropdown — projection of the ONE UoM registry (`lib/uom`, ADR-923 «3γ» Α10)
 * - Auto-calculated total per line
 * - Responsive: table on desktop, cards on mobile
 *
 * @see ADR-267 §4.1 (Line Items)
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
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
import { adoptedUom } from '@/lib/uom/uom-registry';
import { UomSelect } from '@/components/shared/UomSelect';
import { atoeCategoryOptions, materialOptionLabel } from '@/lib/procurement/scope-options';
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

interface LineNumberInputProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly disabled: boolean;
  readonly ariaLabel: string;
  readonly placeholder?: string;
  readonly step?: number;
}

/**
 * Ποσότητα / τιμή μονάδας γραμμής — ΜΙΑ φορά για πίνακα και κάρτα κινητού (CHECK 3.28, ADR-923 §5.11 «3γ»).
 * Το `NumericField` (ADR-706) αντί για `type="number"`: κανένα βελάκι που τρώει το στενό κελί (η τιμή «500» έδειχνε «50»),
 * και το ελληνικό κόμμα δεν χάνεται μισογραμμένο. `blankValue={0}` ⇒ το μηδέν εμφανίζεται κενό, όπως πριν.
 */
function LineNumberInput({ value, onChange, disabled, ariaLabel, placeholder, step }: LineNumberInputProps) {
  return (
    <NumericField
      className="text-right tabular-nums"
      aria-label={ariaLabel}
      value={value}
      onValueChange={onChange}
      min={0}
      step={step}
      blankValue={0}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
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
  const categoryOptions = atoeCategoryOptions((code) => t(`categories.${code}`));

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
        // Α10: η μονάδα του υλικού (λεξιλόγιο BOQ) στον κανονικό κωδικό — μόνο όσο η γραμμή έχει την προεπιλογή.
        const unit = adoptedUom(item.unit, mat.unit);
        if (unit !== null) updates.unit = unit;
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
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
                            {materialOptionLabel(m)}
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
                  <LineNumberInput
                    value={item.quantity}
                    onChange={(quantity) => onUpdateItem(item.tempId, { quantity })}
                    ariaLabel={t('items.quantity')}
                    disabled={readOnly}
                  />
                </TableCell>
                <TableCell>
                  <UomSelect
                    value={item.unit}
                    onValueChange={(unit) => onUpdateItem(item.tempId, { unit })}
                    units={PROCUREMENT_UNIT_OPTIONS}
                    disabled={readOnly}
                    compact
                  />
                </TableCell>
                <TableCell>
                  <LineNumberInput
                    value={item.unitPrice}
                    onChange={(unitPrice) => onUpdateItem(item.tempId, { unitPrice })}
                    ariaLabel={t('items.unitPrice')}
                    step={0.01}
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
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
                        {materialOptionLabel(m)}
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
              <LineNumberInput
                value={item.quantity}
                onChange={(quantity) => onUpdateItem(item.tempId, { quantity })}
                ariaLabel={t('items.quantity')}
                placeholder={t('items.quantityShort')}
                disabled={readOnly}
              />
              <UomSelect
                value={item.unit}
                onValueChange={(unit) => onUpdateItem(item.tempId, { unit })}
                units={PROCUREMENT_UNIT_OPTIONS}
                disabled={readOnly}
                compact
              />
              <LineNumberInput
                value={item.unitPrice}
                onChange={(unitPrice) => onUpdateItem(item.tempId, { unitPrice })}
                ariaLabel={t('items.unitPrice')}
                placeholder={t('items.unitPriceShort')}
                step={0.01}
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
