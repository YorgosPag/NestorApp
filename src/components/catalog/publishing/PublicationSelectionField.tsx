'use client';

/**
 * @fileoverview **Το εύρος `selection`** — ό,τι επιλέχθηκε χειροκίνητα, με αφαίρεση και άνοιγμα του διαλόγου (ADR-923 §5.6.1).
 * @related hooks/catalog/useCatalogReferenceLookup.ts (τα ονόματα των επιλογών)
 * @module components/catalog/publishing/PublicationSelectionField
 *
 * ⚠️ **Ένα έγγραφο ανά ονομαζόμενη επιλογή**: το όριο είναι 2000, άρα ονομάζουμε μόνο τις πρώτες και τις υπόλοιπες κατ' απαίτηση.
 */

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { useCatalogReferenceLookup } from '@/hooks/catalog/useCatalogReferenceLookup';
import type { PublicationSelectionEntry } from '@/subapps/catalog/types/publication';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { toggleSelectionEntry } from './publication-draft';
import { PublicationSelectionDialog } from './PublicationSelectionDialog';

/** Πόσες επιλογές ονομάζονται πριν από το «Εμφάνιση όλων». */
const NAMED_ENTRIES = 20;

export interface PublicationSelectionFieldProps {
  readonly entries: readonly PublicationSelectionEntry[];
  readonly disabled: boolean;
  readonly onChange: (entries: readonly PublicationSelectionEntry[]) => void;
}

export function PublicationSelectionField({ entries, disabled, onChange }: PublicationSelectionFieldProps) {
  const { t } = useCatalogText();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const families = useCatalogCollection('CATALOG_FAMILIES').items;
  const familyById = useMemo(() => new Map(families.map((family) => [family.id, family])), [families]);
  const named = showAll ? entries : entries.slice(0, NAMED_ENTRIES);
  const { describe } = useCatalogReferenceLookup(named, familyById);
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label={t('publishing.scope.selection')}>
      <p className="m-0 text-sm text-muted-foreground" role="status">
        {entries.length === 0 ? t('publishing.selection.empty') : t('publishing.selection.count', { count: entries.length })}
      </p>
      {named.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {named.map((entry) => {
            const name = describe(entry);
            return (
              <li key={`${entry.kind}:${entry.id}`} className="flex items-center gap-1 rounded-md border border-border px-2 py-1">
                <span className="font-mono text-sm">{name}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={t('publishing.selection.remove', { name })} disabled={disabled}
                  onClick={() => onChange(toggleSelectionEntry(entries, entry, false))}><X className="h-3 w-3" aria-hidden /></Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <span className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>{t('publishing.selection.pick')}</Button>
        {named.length < entries.length ? <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(true)}>{t('publishing.selection.showAll')}</Button> : null}
      </span>
      {open ? <PublicationSelectionDialog entries={entries} onClose={() => setOpen(false)} onToggle={(entry, on) => onChange(toggleSelectionEntry(entries, entry, on))} /> : null}
    </section>
  );
}
