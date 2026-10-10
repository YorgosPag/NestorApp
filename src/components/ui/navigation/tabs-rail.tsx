'use client';

/**
 * @fileoverview **Η λωρίδα καρτελών σε στενό χώρο** — μία γραμμή που κυλά, αντί για τρεις που αναδιπλώνονται.
 * @related ADR-912 §2 · ADR-328 (BaseTabs) · components/ui/scroll-rail (η ΜΙΑ μηχανή οριζόντιας κύλισης)
 * @module components/ui/navigation/tabs-rail
 *
 * 📚 Material 3 «scrollable tabs» · Figma mobile: σε στενό πλάτος οι καρτέλες **δεν** αναδιπλώνονται — μένουν σε
 * μία γραμμή και η ενεργή έρχεται σε θέα. Μετρημένο 2026-10-10 στα 390px: 17 καρτέλες κτιρίου έπιαναν **3 γραμμές**
 * εικονιδίων χωρίς όνομα, με ορφανό εικονίδιο στην τρίτη.
 *
 * 🔑 **Καμία δεύτερη μηχανή κύλισης**: το `tablist` του Radix γίνεται η λωρίδα του `ScrollRail` (`as`). Σβήσιμο
 * άκρης, βελάκια μόνο με ποντίκι, αποκάλυψη της ενεργής και της εστιασμένης — όλα έρχονται από εκεί.
 *
 * ♿ **Στόχος αφής 44px** (WCAG 2.5.5): εδώ, όχι στο `TabsTrigger` — η φαρδιά λωρίδα έχει ποντίκι και πυκνότητα.
 */

import React from 'react';

import { ScrollRail } from '@/components/ui/scroll-rail';
import { TabsRailList } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

/** Κάτω από αυτό το πλάτος **του περιέκτη** (rem — ακολουθεί τη γραμματοσειρά του χρήστη) η λωρίδα κυλά. */
export const TABS_RAIL_BELOW_REM = 40;

const ACTIVE_TRIGGER = '[role="tab"][data-state="active"]';

/** Ύψος και πλάτος αφής για κάθε καρτέλα της λωρίδας — και για την καρτέλα-σύνδεσμο (`role="tab"` χωρίς Radix). */
const TOUCH_TARGET = '[&>[role=tab]]:min-h-11 [&>[role=tab]]:min-w-11';

export interface TabsRailProps {
  /** Η ενεργή τιμή — όταν αλλάζει, η ενεργή καρτέλα έρχεται σε θέα. */
  readonly value: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}

export function TabsRail({ value, className, children }: TabsRailProps): React.ReactElement {
  const { t } = useTranslation(['common-actions']);
  const colors = useSemanticColors();

  return (
    <ScrollRail
      as={TabsRailList}
      prevLabel={t('common-actions:actions.previous')}
      nextLabel={t('common-actions:actions.next')}
      revealSelector={ACTIVE_TRIGGER}
      revealKey={value}
      frameClassName={cn('w-full rounded-md p-1', colors.bg.card, className)}
      className={TOUCH_TARGET}
    >
      {children}
    </ScrollRail>
  );
}
