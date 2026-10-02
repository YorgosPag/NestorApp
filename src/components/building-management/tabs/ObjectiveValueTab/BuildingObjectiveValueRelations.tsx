'use client';

/**
 * @fileoverview **Η σχέση μονάδας ↔ παρακολουθημάτων στο συρτάρι** (ADR-898 §19 · §20): η μονάδα δείχνει τους χώρους της και
 * το ποσό «μαζί με τα παρακολουθήματα»· ο χώρος δείχνει σε ποια μονάδα ανήκει. Κάθε όνομα ανοίγει τη δική του ανάλυση.
 * @module components/building-management/tabs/ObjectiveValueTab/BuildingObjectiveValueRelations
 *
 * 🔑 **Προβολή, όχι δεύτερη μέτρηση**: το ποσό της δέσμης βγαίνει από τον **ίδιο** κανόνα με το σύνολο
 *   (`buildingObjectiveValueTotal`) πάνω στις **ίδιες** γραμμές — ποσό μόνο όταν όλα τα μέρη έχουν ποσό, αλλιώς πόσα
 *   λείπουν. Δεν προστίθεται πουθενά στο σύνολο του κτιρίου.
 * 🔑 **Θέση ≠ ανάθεση** (§20): χώρος της μονάδας σε **άλλο** κτίριο = αναφορά με σύνδεσμο προς εκείνο το κτίριο,
 *   **χωρίς** ποσό και **έξω** από τη δέσμη (ο τύπος `BuildingSpaceReference` δεν έχει `value`). Χώρος εδώ με μονάδα
 *   άλλου κτιρίου ⇒ ο κάτοχος με σύνδεσμο προς το κτίριό του.
 */

import React, { useId } from 'react';

import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/intl-formatting';
import { buildingObjectiveValueTotal } from '@/lib/objective-value/building-objective-value';
import type {
  BuildingObjectiveValueRow,
  BuildingSpaceReference,
  OtherBuildingRef,
} from '@/lib/objective-value/building-objective-values-contract';
import { ENTITY_ROUTES } from '@/lib/routes';
import { Link } from '@/lib/workspace/navigation';

import type { BuildingObjectiveValueLabels } from './useBuildingObjectiveValueLabels';

const B = 'objective-value:building';

interface RelationsProps {
  readonly row: BuildingObjectiveValueRow;
  readonly rows: readonly BuildingObjectiveValueRow[];
  /** Χώροι μονάδων του κτιρίου σε άλλο κτίριο — εκτός πίνακα και συνόλου. */
  readonly references: readonly BuildingSpaceReference[];
  readonly labels: BuildingObjectiveValueLabels;
  readonly onOpen: (row: BuildingObjectiveValueRow) => void;
}

/** Σύνδεσμος προς άλλο κτίριο — μέσα από το σύνορο του χώρου εργασίας. */
function OtherBuildingLink({ building, text }: { readonly building: OtherBuildingRef; readonly text: string }) {
  return (
    <Button asChild variant="link" size="sm" className="h-auto p-0">
      {/* Το ορατό κείμενο ΕΙΝΑΙ το όνομα — κανένα `aria-label` που θα το έκρυβε (WCAG 2.5.3). */}
      <Link href={ENTITY_ROUTES.buildings.withId(building.buildingId)}>{text}</Link>
    </Button>
  );
}

function BundleTotal({ unit, attachments, labels }: { readonly unit: BuildingObjectiveValueRow; readonly attachments: readonly BuildingObjectiveValueRow[]; readonly labels: BuildingObjectiveValueLabels }) {
  const total = buildingObjectiveValueTotal([unit, ...attachments]);
  const text =
    total.kind === 'exact'
      ? labels.t(`${B}.relations.bundle`, { amount: formatCurrency(total.value) })
      : labels.t(`${B}.relations.bundleIncomplete`, { pending: total.pending, items: total.items });
  return <p className="m-0 text-sm font-medium text-foreground">{text}</p>;
}

/** Οι χώροι της μονάδας σε άλλο κτίριο: όνομα · πού βρίσκονται · **κανένα** ποσό. */
function References({ references, labels }: { readonly references: readonly BuildingSpaceReference[]; readonly labels: BuildingObjectiveValueLabels }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="m-0 text-sm font-semibold text-foreground">{labels.t(`${B}.elsewhere.title`)}</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {references.map((reference) => (
          <li key={reference.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-foreground">{labels.kind(reference.kind)} · {labels.referenceName(reference)}</span>
            <OtherBuildingLink
              building={reference.locatedIn}
              text={labels.t(`${B}.elsewhere.locatedIn`, { building: labels.otherBuilding(reference.locatedIn) })}
            />
          </li>
        ))}
      </ul>
      <p className="m-0 text-xs text-muted-foreground">{labels.t(`${B}.elsewhere.note`)}</p>
    </section>
  );
}

function Attachments({ row, rows, references, labels, onOpen }: RelationsProps) {
  const headingId = useId();
  const attachments = rows.filter((candidate) => candidate.space?.ownerUnitId === row.id);
  const elsewhere = references.filter((reference) => reference.ownerUnitId === row.id);
  if (attachments.length === 0 && elsewhere.length === 0) return <p className="m-0 text-xs text-muted-foreground">{labels.t(`${B}.relations.none`)}</p>;
  return (
    <>
      {attachments.length > 0 && (
        <section aria-labelledby={headingId} className="flex flex-col gap-2">
          <h3 id={headingId} className="m-0 text-sm font-semibold text-foreground">{labels.t(`${B}.relations.attachments`)}</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onOpen(attachment)}>
                  {labels.kind(attachment.kind)} · {labels.rowName(attachment)}
                </Button>
                <span className="tabular-nums text-muted-foreground">{labels.amount(attachment.value) ?? labels.status(attachment.value)}</span>
              </li>
            ))}
          </ul>
          <BundleTotal unit={row} attachments={attachments} labels={labels} />
          {elsewhere.length > 0 && <p className="m-0 text-xs text-muted-foreground">{labels.t(`${B}.elsewhere.bundleNote`)}</p>}
        </section>
      )}
      {elsewhere.length > 0 && <References references={elsewhere} labels={labels} />}
    </>
  );
}

function Owner({ row, rows, labels, onOpen }: RelationsProps) {
  const space = row.space;
  const ownerId = space?.ownerUnitId ?? null;
  const owner = ownerId === null ? undefined : rows.find((candidate) => candidate.id === ownerId);
  if (owner !== undefined) {
    return (
      <p className="m-0 flex flex-wrap items-center gap-1 text-sm text-foreground">
        {labels.t(`${B}.relations.owner`)}
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onOpen(owner)}>
          {labels.rowName(owner)}
        </Button>
      </p>
    );
  }
  if (space !== null && ownerId !== null && space.ownerElsewhere !== null) {
    return (
      <section className="flex flex-col gap-1">
        <p className="m-0 flex flex-wrap items-center gap-1 text-sm text-foreground">
          {labels.t(`${B}.relations.owner`)}
          <OtherBuildingLink building={space.ownerElsewhere} text={labels.ownerElsewhere(space.ownerUnitName, space.ownerElsewhere)} />
        </p>
        <p className="m-0 text-xs text-muted-foreground">{labels.t(`${B}.elsewhere.ownerNote`)}</p>
      </section>
    );
  }
  return <p className="m-0 text-sm text-muted-foreground">{labels.t(`${B}.relations.unattached`)}</p>;
}

/** Μονάδα ⇒ τα παρακολουθήματά της (και όσα βρίσκονται αλλού) · χώρος ⇒ η μονάδα του. */
export function BuildingObjectiveValueRelations(props: RelationsProps) {
  return props.row.space === null ? <Attachments {...props} /> : <Owner {...props} />;
}
