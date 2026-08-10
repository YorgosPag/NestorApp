'use client';

/**
 * 🔴 ADR-739 §67 — **μια εντολή μενού**: εικονίδιο (ή κενό αυλάκι) + ετικέτα, με τον έναν κανόνα
 * ενεργοποίησης.
 *
 * ## Γιατί εξήχθη (CHECK 3.28, μετρημένο 2026-08-10)
 * Το `RangeMenuCommand` και το `TextMenuCommand` ήταν **κατά λέξη** το ίδιο σώμα — 13 γραμμές /
 * 106 tokens, πιασμένα από το jscpd μέσα στο ίδιο commit. Και το ουσιώδες δεν είναι οι γραμμές:
 * το **κενό αυλάκι** των 16px (`<DxfMenuIcon>` χωρίς παιδί) είναι που κρατά τις ετικέτες
 * στοιχισμένες όταν κάποιο item δεν έχει εικονίδιο. Δύο αντίγραφα σημαίνουν ότι μια μελλοντική
 * αλλαγή στοίχισης θα εφαρμοστεί στο ένα μενού και θα ξεχαστεί στο άλλο — και η διαφορά
 * φαίνεται **μόνο με το μάτι**, σε δύο επιφάνειες που δεν εμφανίζονται ποτέ ταυτόχρονα.
 *
 * ## 🔴 Ο κανόνας ενεργοποίησης είναι Η ΑΠΟΥΣΙΑ ΤΟΥ ΧΕΙΡΙΣΤΗ
 * `onSelect === undefined` ⇒ γκρίζο. Ο καλών **δεν** περνά ξεχωριστό `disabled`: ό,τι δεν έχει
 * πράξη είναι δομικά ανενεργό, και δεν υπάρχει τρόπος να ξεχαστεί ένα `disabled` σε δεκαπέντε
 * items. Είναι ο ίδιος κανόνας που ήδη επέβαλλαν και τα δύο μενού — απλώς τώρα γράφεται μία φορά.
 *
 * @module subapps/dxf-viewer/ui/components/dxf-context-menu/DxfMenuCommandItem
 * @see ui/components/table-range-menu/TableRangeMenuItems.tsx — ο καταναλωτής
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DxfMenuIcon, DxfMenuItem, DxfMenuLabel } from './DxfContextMenu';

/** Το μέγεθος γλύφου κάθε μενού συμφραζομένων του viewer — ένας αριθμός, μία δήλωση. */
const ICON_SIZE = 15;

export interface DxfMenuCommandItemProps {
  /** `null` όπου το Excel δείχνει item **χωρίς** εικονίδιο — το αυλάκι μένει, η στοίχιση ισχύει. */
  readonly icon: LucideIcon | null;
  readonly labelKey: string;
  /** `undefined` ⇒ γκρίζο. Δες την κεφαλίδα: η απουσία **είναι** ο κανόνας. */
  readonly onSelect: (() => void) | undefined;
}

export function DxfMenuCommandItem({
  icon: Icon, labelKey, onSelect,
}: DxfMenuCommandItemProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');

  return (
    <DxfMenuItem disabled={!onSelect} onSelect={onSelect}>
      <DxfMenuIcon>{Icon ? <Icon size={ICON_SIZE} aria-hidden="true" /> : null}</DxfMenuIcon>
      <DxfMenuLabel>{t(labelKey)}</DxfMenuLabel>
    </DxfMenuItem>
  );
}
