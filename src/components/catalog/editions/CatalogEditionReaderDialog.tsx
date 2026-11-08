'use client';

/**
 * @fileoverview **Ο αναγνώστης εντύπου μέσα στην εφαρμογή** (ADR-923 §5.15.3) — σχεδόν πλήρης οθόνη, για τον ιδιοκτήτη (προβολή
 *   πριν/αφού μοιραστεί) και τον αγοραστή (τα έντυπα του προμηθευτή του). Η βιτρίνα **δεν** τον χρειάζεται: εκεί ο αναγνώστης
 *   είναι σελίδα με δική της διεύθυνση.
 * @module components/catalog/editions/CatalogEditionReaderDialog
 *
 * 🔑 Ο εκδότης της άδειας ανά έκδοση έρχεται από τον καλούντα (`issueOf`): αυτός ξέρει την πόρτα του θεατή του.
 * 🔑 Χωρίς `#page=N`: η διεύθυνση ανήκει στην οθόνη από κάτω, όχι στον διάλογο.
 * 🔑 «Άνοιγμα ισχύουσας» αλλάζει έντυπο **μέσα** στον ίδιο διάλογο (ο αναγνώστης ξαναφορτώνει μόνο επειδή άλλαξε η ταυτότητα).
 */

import React, { useMemo, useState } from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePublicCatalogText } from '@/components/public-catalog/public-catalog-text';
import { CatalogEditionReader } from './CatalogEditionReader';
import type { CatalogEditionOpener } from './CatalogEditionShelf';
import type { CatalogEditionReaderDialogProps } from './edition-surface-props';

export function CatalogEditionReaderDialog({ edition, editions, issueOf, onClose }: CatalogEditionReaderDialogProps) {
  const { text } = usePublicCatalogText();
  const [shown, setShown] = useState(edition);
  // Πρώτα ο άμεσος διάδοχος, αν είναι ισχύων γι' αυτόν τον θεατή (ο ιδιοκτήτης έχει ένα ισχύον ανά κοινό)· αλλιώς το ισχύον του ραφιού.
  const current = editions.find((candidate) => candidate.id === shown.supersededBy && candidate.current)
    ?? editions.find((candidate) => candidate.shelfKey === shown.shelfKey && candidate.current)
    ?? null;
  const issue = useMemo(() => issueOf(shown.id), [issueOf, shown.id]);
  const opener = useMemo<CatalogEditionOpener>(() => ({ kind: 'action', onOpen: setShown }), []);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex h-[92dvh] max-w-6xl flex-col gap-3">
        <DialogHeader><DialogTitle>{text(shown.title)}</DialogTitle></DialogHeader>
        <CatalogEditionReader edition={shown} issue={issue} current={current} opener={opener} pageInUrl={false} className="min-h-0 flex-1" />
      </DialogContent>
    </Dialog>
  );
}
