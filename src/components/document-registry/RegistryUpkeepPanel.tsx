'use client';

/**
 * @fileoverview ADR-915 §35 — **η ενότητα «Μόνιμες υποχρεώσεις»** του μητρώου: η εφαρμογή προτείνει, ο άνθρωπος αποφασίζει.
 * @related lib/document-validity/property-upkeep.ts (πρόταση · απόφαση) · RegistryUpkeepItem.tsx (ένα στοιχείο — ΚΟΙΝΟ με την καρτέλα ακινήτου, §36) ·
 *   hooks/document-registry/useUpkeepDeclaration.ts (η αποστολή)
 * @module components/document-registry/RegistryUpkeepPanel
 *
 * 🏆 Arthur Online: απαιτήσεις «τικάρονται» σε λευκό κουτί, χωρίς προεπιλογή ανά τύπο· «mark as completed» χωρίς λόγο.
 *    Εδώ: η εφαρμογή **προτείνει** από κλάση + φάση και **λέει γιατί** · η εξαίρεση θέλει λόγο · η απόφαση κρατά αν
 *    ακολούθησε ή **παρέκαμψε** την πρόταση.
 * 🔑 **Χωριστά από τις γραμμές**: η πρόταση **δεν** είναι κατάσταση εγγράφου — καμία νέα κάρτα, κανένα φίλτρο, καμία
 *    ψευδής κόκκινη. Μόνο η επιβεβαίωση γίνεται απαίτηση, και τότε «λείπει» / «τι σταματά» τα λέει ο ΙΔΙΟΣ πυρήνας.
 * 🔑 **Κανένας υπολογισμός**: πρόταση και απόφαση ήρθαν έτοιμες από τον διακομιστή. Χωρίς δικαίωμα ⇒ μόνο ανάγνωση.
 */

import React from 'react';

import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { UpkeepItem } from '@/lib/document-validity/property-upkeep';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { upkeepItemKeyOf, type UpkeepDeclarationSubmit } from '@/hooks/document-registry/useUpkeepDeclaration';
import { RegistryUpkeepItem } from '@/components/document-registry/RegistryUpkeepItem';
import { CONVEYANCE_NS, LEGALITY_NS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import {
  UPKEEP_KEYS,
  UPKEEP_SECTION_LEAD_KEYS,
  UPKEEP_SECTION_TITLE_KEYS,
  type UpkeepSectionPlace,
} from '@/components/document-registry/upkeep-labels';

export interface UpkeepItemsSectionProps {
  /** Μοναδικό `id` της επικεφαλίδας (`aria-labelledby`). */
  readonly headingId: string;
  /** Πού ζει — αποφασίζει τίτλο και υπότιτλο: μητρώο · καρτέλα ακινήτου (§36) · συρτάρι δημιουργίας (§37). */
  readonly place: UpkeepSectionPlace;
  readonly items: readonly UpkeepItem[];
  /** Ονόματα ακινήτων (μητρώο) — `null` στην καρτέλα του ίδιου του ακινήτου. */
  readonly names: Pick<DocumentRegistryResponse, 'properties'> | null;
  /** Η αποστολή απόφασης — `null` όπου **δεν** υπάρχει πράξη (συρτάρι δημιουργίας: δεν υπάρχει ακόμη ακίνητο). */
  readonly declaration: UpkeepDeclarationSubmit | null;
  readonly canDecide: boolean;
  /** Απόσταση από το περιβάλλον της (π.χ. πάνω από τα αρχεία στην καρτέλα ακινήτου). */
  readonly className?: string;
}

/**
 * Η ενότητα — ΜΙΑ για μητρώο **και** καρτέλα ακινήτου (§36): τίτλος + «Εκκρεμούν: N» + στοιχεία. **Τίποτα** όταν δεν
 * υπάρχει ούτε πρόταση ούτε απόφαση (κανένα άδειο πλαίσιο).
 */
export function UpkeepItemsSection(props: UpkeepItemsSectionProps): React.ReactElement | null {
  const { headingId, place, items, names, declaration, canDecide, className } = props;
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  if (items.length === 0) return null;
  const pending = items.filter((item) => item.declaration === null).length;
  return (
    <section className={cn('flex flex-col gap-3', className)} aria-labelledby={headingId}>
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="m-0 text-lg font-semibold text-foreground">
          {t(UPKEEP_SECTION_TITLE_KEYS[place])}
          {/* Στο συρτάρι δεν «εκκρεμεί» τίποτα ακόμη: δεν υπάρχει ακίνητο να αποφασιστεί. */}
          {place === 'create' ? null : (
            <>
              {' '}
              <span className="text-sm font-normal text-muted-foreground">{t(UPKEEP_KEYS.pending, { count: pending })}</span>
            </>
          )}
        </h2>
        <p className="m-0 text-sm text-muted-foreground">{t(UPKEEP_SECTION_LEAD_KEYS[place])}</p>
      </header>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item) => (
          <li key={upkeepItemKeyOf(item.propertyId, item.documentKind)}>
            <Card className="p-4">
              <RegistryUpkeepItem item={item} names={names} declaration={declaration} canDecide={canDecide} />
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface RegistryUpkeepPanelProps {
  readonly registry: Pick<DocumentRegistryResponse, 'properties' | 'upkeep'>;
  readonly declaration: UpkeepDeclarationSubmit;
  readonly canDecide: boolean;
}

/** Η ενότητα του μητρώου — όλο το χαρτοφυλάκιο (§36: κάθε ακίνητο του γραφείου, όχι μόνο όσα έχουν έγγραφο). */
export function RegistryUpkeepPanel({ registry, declaration, canDecide }: RegistryUpkeepPanelProps): React.ReactElement | null {
  return (
    <UpkeepItemsSection
      headingId="registry-upkeep-title"
      place="registry"
      items={registry.upkeep}
      names={registry}
      declaration={declaration}
      canDecide={canDecide}
    />
  );
}
