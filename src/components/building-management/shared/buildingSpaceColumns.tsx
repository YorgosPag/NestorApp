'use client';

/**
 * @fileoverview **Οι κοινές στήλες των πινάκων χώρων κτιρίου** (Μονάδες · Αποθήκες · Στάθμευση) — όροφος · επιφάνεια ·
 * διάθεση, **ένας** ορισμός για οθόνη **και** εξαγωγή XLSX (ADR-898 Φ4β).
 * @related `buildingSpacePriceColumn.tsx` (η στήλη τιμής) · `space-table-export.ts` · ADR-184
 * @module components/building-management/shared/buildingSpaceColumns
 *
 * 🧹 Ως τις 2026-10-02 κάθε καρτέλα έγραφε αυτές τις στήλες μόνη της — όροφος και επιφάνεια **τρεις** φορές, η διάθεση
 * **δύο** φορές αυτούσια. Η εξαγωγή θα τις τριπλασίαζε ξανά (`exportCell` ανά αντίγραφο)· εδώ γράφονται μία φορά.
 */

import { useMemo } from 'react';

import { SpaceStatusBadges } from '@/components/shared/unit-status/SpaceStatusBadges';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { spaceAvailabilityBucket } from '@/lib/spaces/space-availability';
import type { SpaceStatusSource } from '@/lib/spaces/space-status-split';
import { spaceStatusBadges } from '@/lib/units/unit-status-badges';
import { cn } from '@/lib/utils';

import type { SpaceColumn } from './types';
import type { FloorLabelInput } from '@/hooks/useFloorLabel';
import { hostedFloorNumber, hostedFloorRef } from '@/lib/floor/hosted-floor';

/** Ό,τι κουβαλά όροφο — ακίνητο, θέση, αποθήκη (ADR-903 §6). */
type FloorBearing = { readonly floor?: unknown; readonly floorKind?: unknown };

/**
 * Ο όροφος **όπως φαίνεται** (ADR-903) — η ετικέτα «2ο Υπόγειο» / «Πυλωτή» από το **ένα** σύνορο ανάγνωσης
 * (`hostedFloorRef`: αριθμός + είδος, ή παλιό κείμενο μέσω parser) και τον **έναν** μορφοποιητή. Στο αρχείο το ίδιο
 * κείμενο με την οθόνη (κενό αντί για «—»). Ταξινόμηση **αριθμητική** (ήταν λεξικογραφική πάνω σε κείμενο: «-1» > «10»).
 */
export function buildFloorColumn<T extends FloorBearing>(
  label: string,
  mutedTextClass: string,
  floorLabel: (value: FloorLabelInput) => string,
): SpaceColumn<T> {
  const shown = (item: T): string | null => floorLabel(hostedFloorRef(item)) || null;
  return {
    key: 'floor',
    label,
    width: 'w-28',
    // Αριθμός μένει αριθμός (ισόγειο `0` ≠ «χωρίς όροφο»)· απουσία ⇒ `null` = τελευταία και προς τις δύο κατευθύνσεις.
    sortValue: (item) => hostedFloorNumber(item),
    render: (item) => <span className={cn('text-sm', mutedTextClass)}>{shown(item) ?? '—'}</span>,
    exportCell: shown,
  };
}

/**
 * Η επιφάνεια (m²) — στο αρχείο **αριθμός** με άθροισμα στη γραμμή συνόλου, **μόνο** όταν κάθε γραμμή έχει επιφάνεια.
 * Απουσία ⇒ κενό κελί, και στην ταξινόμηση τελευταία (ποτέ «0» που θα την έκανε «τη μικρότερη»).
 */
export function buildAreaColumn<T>(label: string, areaOf: (item: T) => number | null): SpaceColumn<T> {
  return {
    key: 'area',
    label,
    width: 'w-24',
    sortValue: areaOf,
    render: (item) => <span className="font-mono text-xs">{areaOf(item) ?? '—'}</span>,
    exportCell: areaOf,
    exportFormat: 'number',
    exportTotal: 'sum',
  };
}

/**
 * **Η στήλη «Διάθεση»** (ADR-777 §8.60.20) — διάθεση από το `commercialStatus` + λειτουργική εξαίρεση, από τον ΕΝΑ
 * επιλυτή σημάτων (`spaceStatusBadges`): η οθόνη τα ζωγραφίζει ως σήματα, το αρχείο τα γράφει ως κείμενο.
 */
export function useSpaceAvailabilityColumn<T extends SpaceStatusSource>(): SpaceColumn<T> {
  const { t } = useTranslation('properties-enums');
  return useMemo(
    () => ({
      key: 'status',
      label: t('unitStatus.availability'),
      width: 'w-36',
      sortValue: (item) => spaceAvailabilityBucket(item),
      render: (item) => <SpaceStatusBadges space={item} />,
      exportCell: (item) => spaceStatusBadges(item, t).map((badge) => badge.label).join(' · ') || null,
    }),
    [t],
  );
}
