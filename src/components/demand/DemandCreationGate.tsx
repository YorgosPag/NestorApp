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

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ `/demands/new` (ADR-777 §8.36).
//
// Το dropdown είδους ακινήτου βάφεται από το `PROPERTY_TYPE_I18N_KEYS`, δηλαδή από το
// namespace `properties-enums` — που **δεν** ανήκει στο κέλυφος και φορτώνεται
// **ασύγχρονα**. Χωρίς αυτή την εγγραφή το πρώτο καρέ δείχνει **14 ωμά κλειδιά**
// (`types.studio` · `types.apartment` · …) εκεί ακριβώς όπου ο άνθρωπος διαλέγει.
//
// 🔴 **ΕΔΩ, ΚΑΙ ΟΧΙ ΣΤΟ `page.tsx`**: εκείνο είναι Server Component και τα Server/Client
// δέντρα έχουν **ΞΕΧΩΡΙΣΤΟΥΣ γράφους module** — εγγραφή από εκεί θα έγραφε σε **άλλο**
// στιγμιότυπο i18next, δηλαδή πράσινη κλήση που δεν κάνει τίποτα.
//
// ⚠️ **Στατική εισαγωγή, εμβέλεια MODULE**: με `import()` το κλειδί θα ήταν ωμό για ένα
// καρέ και **κρυμμένο** από το CHECK 3.51 — μετακίνηση του ελαττώματος, όχι διόρθωση.
// Το Next κόβει ήδη chunk ανά διαδρομή, άρα τα 577 bytes δεν ταξιδεύουν αλλού.
import routeSlice from '@/i18n/generated/routes/demands__new.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

// ⚠️ Εμβέλεια MODULE, όχι render και όχι effect: τρέχει **πριν** αποδοθεί οτιδήποτε.
registerRouteSlice(routeSlice);

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
