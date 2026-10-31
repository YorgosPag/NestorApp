'use client';

/**
 * @fileoverview **Η λίστα συνταγών έκδοσης** — όνομα, κωδικός, γλώσσα και κοινό τιμών (ADR-923 §5.6.1).
 * @related shared/CatalogList.tsx (η γραμμή είναι κουμπί με `aria-current`)
 * @module components/catalog/publishing/PublicationRecipeList
 *
 * 🔑 Το σήμα λέει **λέξη**: «Με τιμές» / «Χωρίς τιμές» — ο εξατομικευμένος κατάλογος ξεχωρίζει με μια ματιά από τον τεχνικό.
 */

import React from 'react';
import { BookOpen } from 'lucide-react';

import type { PublicationRecipeWire } from '@/subapps/catalog/types/publication';
import { CatalogListItem, CatalogListSection } from '../shared/CatalogList';
import { useCatalogText } from '../shared/catalog-ui-hooks';

interface RecipeListProps {
  readonly recipes: readonly PublicationRecipeWire[];
  readonly selectedCode: string | null;
  readonly onSelect: (code: string) => void;
}

export function PublicationRecipeList({ recipes, selectedCode, onSelect }: RecipeListProps) {
  const { t, text } = useCatalogText();
  const sorted = [...recipes].sort((a, b) => a.code.localeCompare(b.code));
  if (sorted.length === 0) return <p className="m-0 p-2 text-sm text-muted-foreground">{t('publishing.empty')}</p>;
  return (
    <CatalogListSection title={t('publishing.recipes')} count={sorted.length}>
      {sorted.map((recipe) => (
        <CatalogListItem
          key={recipe.id}
          icon={BookOpen}
          primary={text(recipe.labels, recipe.code)}
          secondary={recipe.code}
          badges={[{ label: t(`publishing.pricing.${recipe.pricing.kind}`), variant: 'outline' }]}
          selected={recipe.code === selectedCode}
          onSelect={() => onSelect(recipe.code)}
        />
      ))}
    </CatalogListSection>
  );
}
