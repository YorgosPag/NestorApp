"use client";

/**
 * BimBoqTab — 3-section read-only BOQ view for a selected BIM entity.
 *
 * Sections: parent summary row → multi-layer children tree → quantity context.
 * Queries Firestore boq_items once on mount (no real-time — BOQ changes are
 * infrequent and managed in the BOQ subapp). ADR-366 C.4.Q3–Q4.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { buildBoqTree, type BoqTree } from './boq-tree-builder';
import type { BOQItem } from '@/types/boq';

interface BimBoqTabProps {
  bimId: string;
  companyId: string;
  projectId: string;
}

export function BimBoqTab({ bimId, companyId, projectId }: BimBoqTabProps) {
  const { t } = useTranslation('bim3d');
  const [tree, setTree] = useState<BoqTree | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      const q = query(
        collection(db, COLLECTIONS.BOQ_ITEMS),
        where('companyId', '==', companyId),
        where('projectId', '==', projectId),
        where('sourceEntityId', '==', bimId),
      );
      const snap = await getDocs(q);
      if (cancelled) return;
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BOQItem));
      setTree(buildBoqTree(items));
      setLoading(false);
    }

    load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [bimId, companyId, projectId]);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">…</div>;
  }

  if (!tree?.parent) {
    return (
      <div className="flex flex-col items-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">{t('entityCard.boq.empty')}</p>
        <a
          href={`/boq?focusEntityId=${bimId}`}
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          {t('entityCard.boq.openInBoq')}
        </a>
      </div>
    );
  }

  const { parent, children } = tree;

  return (
    <div className="flex flex-col gap-4 p-4 text-sm">
      {/* Section 1: Parent summary */}
      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('entityCard.boq.parentSection')}
        </h4>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-foreground">{parent.title}</span>
            <span className="shrink-0 font-mono text-xs text-foreground">
              {parent.quantity.toFixed(2)} {parent.unit}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('entityCard.boq.layerRow.totalCost')}: {parent.totalCost.toFixed(2)} €
          </p>
        </div>
      </section>

      {/* Section 2: Children (multi-layer) */}
      {children.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('entityCard.boq.childrenSection')}
          </h4>
          <ul className="flex flex-col gap-1">
            {children.map((child) => (
              <li
                key={child.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 rounded px-2 py-1 text-xs hover:bg-muted/40"
              >
                <span className="truncate text-muted-foreground">{child.title}</span>
                <span className="font-mono text-foreground">
                  {child.quantity.toFixed(2)} {child.unit}
                </span>
                <span className="font-mono text-foreground">
                  {child.totalCost.toFixed(2)} €
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Section 3: Open in BOQ link */}
      <a
        href={`/boq?focusEntityId=${bimId}`}
        className="text-xs text-primary underline-offset-2 hover:underline"
      >
        {t('entityCard.boq.openInBoq')} →
      </a>
    </div>
  );
}
