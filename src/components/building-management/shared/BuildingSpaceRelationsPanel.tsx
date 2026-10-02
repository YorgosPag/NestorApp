'use client';

/**
 * @fileoverview **Δίπλα στη λίστα θέσεων/αποθηκών** (ADR-184 · ADR-898 §20 — θέση ≠ ανάθεση):
 * - «Σε άλλο κτίριο»: παρακολουθήματα μονάδων αυτού του κτιρίου που **βρίσκονται** αλλού — αναφορά με σύνδεσμο προς το
 *   κτίριο τους, **κανένα** ποσό, **εκτός** στατιστικών/συνόλων της καρτέλας (μετρούν εκεί).
 * - «Χωρίς κτίριο»: παρακολουθήματα μονάδων αυτού του κτιρίου **χωρίς** κτίριο — μετρούν **εδώ** (κανόνας), αλλά η λίστα
 *   είναι «βρίσκεται εδώ». Επιδιόρθωση ενός κλικ: «Σύνδεση με αυτό το κτίριο» (η ΙΔΙΑ πόρτα με τον διάλογο σύνδεσης).
 * @module components/building-management/shared/BuildingSpaceRelationsPanel
 *
 * Το πρότυπο: το «Include elements in links» του Revit — στοιχεία συνδεδεμένου μοντέλου στο schedule του κύριου, με
 * στήλη που λέει **από πού** είναι, μόνο για ανάγνωση.
 */

import React, { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BuildingSpaceMention, BuildingSpaceReference } from '@/lib/building-spaces/building-space-contract';
import type { BuildingSpaceKind } from '@/lib/building-spaces/building-space-membership';
import { policyErrorMessageOf } from '@/lib/policy';
import { ENTITY_ROUTES } from '@/lib/routes';
import { Link } from '@/lib/workspace/navigation';
import { useNotifications } from '@/providers/NotificationProvider';

import { useBuildingSpaceRelations } from './useBuildingSpaceRelations';

/** Οι γενικές λέξεις ζουν στο λεξιλόγιο της αντικειμενικής (ADR-898 §20) — ΜΙΑ πηγή, όχι δεύτερη μετάφραση. */
const OV = 'objective-value:building';
const R = 'spaceRelations';

type Translate = (key: string, options?: Record<string, unknown>) => string;

function spaceTitle(space: BuildingSpaceMention, t: Translate): string {
  const name = space.name ?? t(`${OV}.unnamed.${space.kind}`);
  return t(`${R}.item`, { space: name, unit: space.ownerUnitName ?? t(`${OV}.unnamed.unit`) });
}

function References({ references, t }: { readonly references: readonly BuildingSpaceReference[]; readonly t: Translate }) {
  const headingId = useId();
  if (references.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(`${OV}.elsewhere.title`)}</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {references.map((space) => (
          <li key={space.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-foreground">{spaceTitle(space, t)}</span>
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link href={ENTITY_ROUTES.buildings.withId(space.locatedIn.buildingId)}>
                {t(`${OV}.elsewhere.locatedIn`, { building: space.locatedIn.label ?? t(`${OV}.elsewhere.unnamedBuilding`) })}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
      <p className="m-0 text-xs text-muted-foreground">{t(`${R}.elsewhereNote`)}</p>
    </section>
  );
}

interface UnplacedProps {
  readonly unplaced: readonly BuildingSpaceMention[];
  readonly t: Translate;
  readonly onPlace: (spaceId: string) => Promise<void>;
}

function Unplaced({ unplaced, t, onPlace }: UnplacedProps) {
  const headingId = useId();
  const [placing, setPlacing] = useState<string | null>(null);
  const { error: notifyError } = useNotifications();
  if (unplaced.length === 0) return null;
  const place = async (spaceId: string) => {
    setPlacing(spaceId);
    try {
      await onPlace(spaceId);
    } catch (error) {
      notifyError(policyErrorMessageOf(error, t) ?? t(`${R}.placeError`));
    } finally {
      setPlacing(null);
    }
  };
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(`${R}.unplacedTitle`)}</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {unplaced.map((space) => (
          <li key={space.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-foreground">{spaceTitle(space, t)}</span>
            <Button type="button" variant="outline" size="sm" disabled={placing !== null} onClick={() => void place(space.id)}>
              {t(`${R}.place`)}
            </Button>
          </li>
        ))}
      </ul>
      <p className="m-0 text-xs text-muted-foreground">{t(`${R}.unplacedNote`)}</p>
    </section>
  );
}

interface PanelProps {
  readonly buildingId: string;
  readonly kind: BuildingSpaceKind;
  /** Η ΙΔΙΑ πόρτα με τον διάλογο «Σύνδεση υπάρχοντος» (`buildingId` = αυτό το κτίριο). */
  readonly onPlace: (spaceId: string) => Promise<void>;
}

export function BuildingSpaceRelationsPanel({ buildingId, kind, onPlace }: PanelProps) {
  const { t } = useTranslation(['building', 'objective-value']);
  const { references, unplaced } = useBuildingSpaceRelations(buildingId, kind);
  if (references.length === 0 && unplaced.length === 0) return null;
  return (
    <aside className="flex flex-col gap-4 rounded-md border border-border p-3">
      <Unplaced unplaced={unplaced} t={t} onPlace={onPlace} />
      <References references={references} t={t} />
    </aside>
  );
}
