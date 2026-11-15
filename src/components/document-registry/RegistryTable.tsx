'use client';

/**
 * @fileoverview ADR-915 §41.5 — **ο πυκνός πίνακας του μητρώου**: μία γραμμή ανά έγγραφο ή κενό, λεπτομέρεια στο πλάι.
 * @related RegistryRowCells.tsx (οι τιμές) · RegistryDocSheet.tsx (η κάρτα) · hooks/document-registry/useRegistryAddress.ts
 * @module components/document-registry/RegistryTable
 *
 * 🏆 Carbon (IBM): γραμμή ~40 px, μία στήλη ανά ερώτηση· Drata/Vanta: «Needs attention» δίπλα στη λήξη. Εδώ επιπλέον η
 *    στήλη **«Μπλοκάρει»** — πότε σταματά συναλλαγή, όχι μόνο πότε λήγει.
 * 🔑 **Στο κινητό λίστα, όχι στοιβαγμένος πίνακας** (CMS Design System · W3C WAI): κάθε τιμή με δική της ετικέτα (`dt`) —
 *    ο ίδιος λόγος που η κάρτα είναι `<article>` + `<dl>` (βλ. `RegistryRowItem`).
 * 🔑 Η κύρια πράξη της γραμμής είναι **ένα** κουμπί (το όνομα του εγγράφου) που ανοίγει το πάνελ με `?doc=`.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TOUCH_TARGET_MIN } from '@/design-system/touch-target';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { registryRowIdOf, registryRowPropertyIdOf, type RegistryRow } from '@/lib/document-validity/document-registry';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { registryPropertyNameOf } from '@/components/document-registry/RegistryPropertyValue';
import { RegistryStateBadge } from '@/components/document-registry/RegistryRowHeader';
import { RegistrySurfaces } from '@/components/document-registry/registry-surfaces';
import {
  BlocksText,
  ExpiryText,
  NextStepText,
  rowDocumentText,
  useRowKindLabel,
} from '@/components/document-registry/RegistryRowCells';
import { LAYOUT_KEYS } from '@/components/document-registry/registry-layout-labels';
import { CONVEYANCE_NS, LEGALITY_NS, REGISTRY_KEYS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';

export interface RegistryRowsProps {
  readonly rows: readonly RegistryRow[];
  readonly registry: DocumentRegistryResponse;
  readonly onOpen: (rowId: string) => void;
}

interface RowProps {
  readonly row: RegistryRow;
  readonly registry: DocumentRegistryResponse;
  readonly onOpen: (rowId: string) => void;
}

/** Πρόθεση ⇒ κώδικας + κείμενα της κάρτας ξεκινούν, μέσα από τον φορτωτή του μητρώου (ιδεμποτικό). */
const warmDocCard = (): void => {
  void RegistrySurfaces.RegistryDocCard.preload();
};

/** Το κουμπί-όνομα που ανοίγει το πάνελ: είδος (έντονο) + αρχείο/«λείπει» από κάτω. */
export function RowOpenButton({ row, registry, onOpen }: RowProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const kind = useRowKindLabel(row);
  return (
    <Button
      type="button" variant="link" onClick={() => onOpen(registryRowIdOf(row))}
      // Πρόθεση ⇒ το κομμάτι της κάρτας κατεβαίνει πριν το πάτημα (το πάνελ ανοίγει γεμάτο).
      onPointerEnter={warmDocCard} onFocus={warmDocCard}
      className={`${TOUCH_TARGET_MIN} h-auto flex-col items-start gap-0 whitespace-normal p-0 text-left`}
    >
      <span className="font-medium text-foreground">{kind}</span>
      <span className="text-xs font-normal text-muted-foreground">{rowDocumentText(t, row, registry)}</span>
    </Button>
  );
}

function PropertyText({ row, registry }: Omit<RowProps, 'onOpen'>): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const name = registryPropertyNameOf(t, registryRowPropertyIdOf(row), registry);
  return <span className={name === null ? 'text-muted-foreground' : 'text-foreground'}>{name ?? t(REGISTRY_KEYS.propertyNone)}</span>;
}

function TableRowOf({ row, registry, onOpen }: RowProps): React.ReactElement {
  return (
    <TableRow data-row-id={registryRowIdOf(row)} className={row.state === 'superseded' ? 'opacity-80' : undefined}>
      <TableCell><RowOpenButton row={row} registry={registry} onOpen={onOpen} /></TableCell>
      <TableCell><PropertyText row={row} registry={registry} /></TableCell>
      <TableCell><RegistryStateBadge state={row.state} /></TableCell>
      <TableCell><ExpiryText row={row} registry={registry} /></TableCell>
      <TableCell><BlocksText row={row} registry={registry} /></TableCell>
      <TableCell><NextStepText row={row} registry={registry} /></TableCell>
    </TableRow>
  );
}

function DesktopTable({ rows, registry, onOpen }: RegistryRowsProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  return (
    <Table>
      <TableCaption className="sr-only">{t(LAYOUT_KEYS.tableCaption)}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t(LAYOUT_KEYS.colDocument)}</TableHead>
          <TableHead scope="col">{t(LAYOUT_KEYS.colProperty)}</TableHead>
          <TableHead scope="col">{t(LAYOUT_KEYS.colState)}</TableHead>
          <TableHead scope="col">{t(LAYOUT_KEYS.colExpiry)}</TableHead>
          <TableHead scope="col">{t(LAYOUT_KEYS.colBlocks)}</TableHead>
          <TableHead scope="col">{t(LAYOUT_KEYS.colNextStep)}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => <TableRowOf key={registryRowIdOf(row)} row={row} registry={registry} onOpen={onOpen} />)}
      </TableBody>
    </Table>
  );
}

function MobileItem({ row, registry, onOpen }: RowProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <RowOpenButton row={row} registry={registry} onOpen={onOpen} />
        <RegistryStateBadge state={row.state} />
      </header>
      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t(LAYOUT_KEYS.colProperty)}</dt>
        <dd className="m-0"><PropertyText row={row} registry={registry} /></dd>
        <dt className="text-muted-foreground">{t(LAYOUT_KEYS.colExpiry)}</dt>
        <dd className="m-0"><ExpiryText row={row} registry={registry} /></dd>
        <dt className="text-muted-foreground">{t(LAYOUT_KEYS.colBlocks)}</dt>
        <dd className="m-0"><BlocksText row={row} registry={registry} /></dd>
        <dt className="text-muted-foreground">{t(LAYOUT_KEYS.colNextStep)}</dt>
        <dd className="m-0"><NextStepText row={row} registry={registry} /></dd>
      </dl>
    </li>
  );
}

/** Πίνακας από `sm` και πάνω· λίστα με ετικέτες στο κινητό. Η ίδια πληροφορία, η ίδια πράξη. */
export function RegistryTable(props: RegistryRowsProps): React.ReactElement {
  return (
    <>
      <div className="hidden sm:block">
        <DesktopTable {...props} />
      </div>
      <ul className="m-0 list-none p-0 sm:hidden">
        {props.rows.map((row) => (
          <MobileItem key={registryRowIdOf(row)} row={row} registry={props.registry} onOpen={props.onOpen} />
        ))}
      </ul>
    </>
  );
}
