'use client';

/**
 * **Η πύλη της Α8 για τη ΖΗΤΗΣΗ** — το κείμενο, πάνω στον κοινό μηχανισμό.
 *
 * @related ADR-777 §7 (Α8 · Α19) · components/shared/DesktopOnlyGate
 * @module components/demand/DemandCreationGate
 *
 * 🔴 **Ο μηχανισμός εξήχθη (ADR-777 Α14, 2026-08-11)** στο
 * `components/shared/DesktopOnlyGate.tsx`: η φόρμα **προσφοράς** υπακούει στην **ίδια**
 * Α8 με **ταυτόσημα** τρία στρώματα — δεύτερη γραφή θα ήταν κλώνος που μπλοκάρει το
 * **CHECK 3.28**. Εδώ μένουν τα **δύο** πράγματα που είναι πραγματικά της ζήτησης: η
 * δυναμική εισαγωγή **της δικής της** φόρμας, και το κείμενο.
 *
 * ⚠️ **Το `ssr: false` δεν είναι βελτιστοποίηση — είναι ορθότητα.** Στον διακομιστή
 * δεν υπάρχει παράθυρο, άρα δεν υπάρχει απάντηση στο «πόσο πλατύ;»· ένα SSR της
 * φόρμας θα έστελνε **σε όλους** ακριβώς ό,τι αυτό το αρχείο υπάρχει για να μη σταλεί.
 */

import React from 'react';
import dynamic from 'next/dynamic';

import { DesktopOnlyGate, DesktopOnlyNotice } from '@/components/shared/DesktopOnlyGate';
import { MY_DEMANDS_ROUTE } from '@/lib/demand/demand-routes';
import type { DemandFormContentProps } from './DemandFormContent';

/**
 * Η φόρμα, **ζητούμενη κατ' απαίτηση**.
 *
 * ⚠️ Δηλώνεται σε **επίπεδο module** και όχι μέσα στο component: ένα `dynamic()` που
 * τρέχει σε κάθε απόδοση παράγει **νέο** component κάθε φορά, οπότε το React το
 * αποσυναρμολογεί και το ξαναφτιάχνει — και η φόρμα θα έχανε ό,τι έγραψε ο άνθρωπος
 * σε κάθε πάτημα πλήκτρου.
 */
const DemandFormContent = dynamic<DemandFormContentProps>(
  () => import('./DemandFormContent').then((module) => module.DemandFormContent),
  { ssr: false },
);

export function DemandCreationGate(props: DemandFormContentProps): React.ReactElement {
  return (
    <DesktopOnlyGate
      wide={() => <DemandFormContent {...props} />}
      narrow={<DesktopOnlyNotice keyBase="demand" backHref={MY_DEMANDS_ROUTE} />}
    />
  );
}
