'use client';

/**
 * @fileoverview **Τα μέρη μιας σύνθετης ένδειξης** — σειρά με σύρσιμο/πληκτρολόγιο, ιδιότητα, μονάδα, σύμβολα πριν/μετά
 *   (ADR-923 §21.6).
 * @module components/catalog/families/CompositePartsList
 *
 * 🔑 Η **σειρά είναι η σειρά της ένδειξης** (IEC 61293 §4.2.5: πρώτα το σύστημα παροχής, μετά οι τιμές) — γι' αυτό σύρεται.
 * 🔑 Ο επιλογέας προσφέρει **μόνο** ό,τι δέχεται ο επικυρωτής (`isCompositePartType`)· η μονάδα μόνο για μέτρηση.
 * 🔑 Τα σύμβολα είναι ουδέτερα ως προς τη γλώσσα («~» = εναλλασσόμενο, IEC 60417-5032), όχι λέξεις: ένα πεδίο, όχι ανά γλώσσα.
 */

import React from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SortableList } from '@/components/ui/sortable/SortableList';
import { reorderByMove } from '@/components/ui/sortable/sortable-model';
import type { CatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import type { CompositeDisplayPart } from '@/subapps/catalog/types/family';
import { CATALOG_LIMITS } from '@/subapps/catalog/vocabulary/catalog-limits';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { AttributePicker } from './AttributePicker';
import { DisplayUnitSelect } from './DisplayUnitSelect';

/** Νέο μέρος: η πρώτη επιλέξιμη ιδιότητα που δεν είναι ήδη μέρος, χωρίς σύμβολα. */
export function newCompositePart(options: readonly AttributeRecord[], used: readonly string[]): CompositeDisplayPart {
  const attributeId = options.find((option) => !used.includes(option.id))?.id ?? options[0]?.id ?? '';
  return { attributeId, displayUnitCode: null, affix: { before: '', after: '' } };
}

function AffixInput({ value, label, disabled, onChange }: { readonly value: string; readonly label: string; readonly disabled: boolean; readonly onChange: (value: string) => void }) {
  return (
    <Input className="w-16 text-center font-mono" value={value} disabled={disabled} aria-label={label}
      maxLength={CATALOG_LIMITS.maxCompositeAffixLength} onChange={(event) => onChange(event.target.value)} />
  );
}

interface PartRow {
  readonly id: string;
  readonly part: CompositeDisplayPart;
  readonly index: number;
}

export function CompositePartsList({ parts, options, library, disabled, onChange }: {
  readonly parts: readonly CompositeDisplayPart[];
  /** Οι ιδιότητες της οικογένειας που μπορούν να γίνουν μέρος. */
  readonly options: readonly AttributeRecord[];
  readonly library: CatalogLibrary;
  readonly disabled: boolean;
  readonly onChange: (parts: readonly CompositeDisplayPart[]) => void;
}) {
  const { t } = useCatalogText();
  const rows: PartRow[] = parts.map((part, index) => ({ id: `part-${index}`, part, index }));
  const setPart = (index: number, part: CompositeDisplayPart) => onChange(parts.map((current, at) => (at === index ? part : current)));
  const renderPart = (row: PartRow, handle: React.ReactNode) => {
    const position = { index: row.index + 1 };
    const { part } = row;
    return (
      <span className="flex flex-wrap items-center gap-1">
        {handle}
        <span className="w-6 text-center text-xs text-muted-foreground">{row.index + 1}</span>
        <AffixInput value={part.affix.before} label={t('families.composites.before', position)} disabled={disabled}
          onChange={(before) => setPart(row.index, { ...part, affix: { ...part.affix, before } })} />
        <AttributePicker className="w-52" value={part.attributeId} options={options} disabled={disabled} placeholder={t('families.composites.attribute')}
          ariaLabel={t('families.composites.partAt', position)} onChange={(attributeId) => setPart(row.index, { ...part, attributeId, displayUnitCode: null })} />
        <DisplayUnitSelect attributeId={part.attributeId} value={part.displayUnitCode} library={library} disabled={disabled}
          onChange={(displayUnitCode) => setPart(row.index, { ...part, displayUnitCode })} />
        <AffixInput value={part.affix.after} label={t('families.composites.after', position)} disabled={disabled}
          onChange={(after) => setPart(row.index, { ...part, affix: { ...part.affix, after } })} />
        <Button type="button" variant="ghost" size="icon" disabled={disabled || parts.length <= 1} aria-label={t('families.composites.removePart', position)}
          onClick={() => onChange(parts.filter((_, at) => at !== row.index))}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </span>
    );
  };
  return (
    <section className="flex flex-col gap-1" aria-label={t('families.composites.parts')}>
      <SortableList items={rows} getId={(row) => row.id} getLabel={(row) => t('families.composites.partAt', { index: row.index + 1 })}
        ariaLabel={t('families.composites.parts')} disabled={disabled}
        onMove={(move) => onChange(reorderByMove(rows, (row) => row.id, move).map((row) => row.part))}
        renderItem={renderPart} />
      <Button type="button" variant="ghost" size="sm" className="self-start" disabled={disabled || options.length === 0 || parts.length >= CATALOG_LIMITS.maxCompositeParts}
        onClick={() => onChange([...parts, newCompositePart(options, parts.map((part) => part.attributeId))])}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />{t('families.composites.addPart')}
      </Button>
    </section>
  );
}
