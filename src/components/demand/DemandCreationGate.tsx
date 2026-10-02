'use client';

/**
 * **Η σελίδα δημιουργίας ΖΗΤΗΣΗΣ** — η φόρμα, σε **κάθε** πλάτος, πάνω στο κοινό κέλυφος.
 *
 * @related ADR-900 §8 #3 · ADR-777 §7 (Α8 · Α9) · components/shared/CreationPageShell
 * @module components/demand/DemandCreationGate
 *
 * 📱 **2026-10-02 — ανοίγει και στο κινητό** (ADR-900 §8 #3): ο αγοραστής ψάχνει κυρίως από κινητό, και η
 * ζήτησή του ήταν η **μόνη** πράξη που του αρνιόμασταν εκεί (η idealista αποθηκεύει αναζήτηση από το app).
 * Το κοινό κέλυφος αντικατέστησε το `DesktopOnlyGate`· εδώ μένει η δυναμική εισαγωγή **της δικής της** φόρμας.
 *
 * ⚠️ **Το `ssr: false` μένει, με άλλο λόγο**: η φόρμα κρίνεται από την ταυτότητα του πελάτη (`useAuth`) και
 * ζωγραφίζει χάρτες MapLibre, που ζητούν `window` — ένα SSR θα αποδιδόταν μισό και θα ξαναγινόταν.
 */

import React from 'react';
import dynamic from 'next/dynamic';

import { CreationFormLoading, CreationPageShell } from '@/components/shared/CreationPageShell';
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
  { ssr: false, loading: CreationFormLoading },
);

export function DemandCreationGate(props: DemandFormContentProps): React.ReactElement {
  return (
    <CreationPageShell>
      <DemandFormContent {...props} />
    </CreationPageShell>
  );
}
