'use client';

/**
 * **Η ΠΥΛΗ ΤΗΣ Α8** — η φόρμα δεν ταξιδεύει σε στενή οθόνη.
 *
 * @related ADR-777 §7 (Α8 · Α19) · §11.6 · SPEC-777D · hooks/media/useViewportClass.ts
 * @module components/demand/DemandCreationGate
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 «ΜΟΝΟ DESKTOP» ΕΙΝΑΙ ΓΕΓΟΝΟΣ **BYTES**, ΟΧΙ ΚΑΝΟΝΑΣ CSS
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τρία στρώματα, και **κανένα δεν είναι `hidden`**:
 *
 * 1. **Ξεχωριστή διαδρομή** (`/demands/new`). Το route-level code splitting του App
 *    Router είναι **αυτόματο** — τεκμηριωμένο: *«Next.js automatically creates a
 *    separate JavaScript bundle for each route … only the JavaScript required for that
 *    page is downloaded»*. Όποιος δεν την ανοίγει, **δεν κατεβάζει τίποτα**.
 * 2. **Δυναμική εισαγωγή** εδώ. Ακόμη κι όποιος **ανοίξει** τη διαδρομή από κινητό
 *    (πληκτρολογημένη διεύθυνση · κοινοποιημένος σύνδεσμος) δεν κατεβάζει τη φόρμα:
 *    το `next/dynamic` την ζητά **μόνο** όταν η μέτρηση πει `wide`.
 * 3. **Τρίτη κατάσταση στη μέτρηση** ({@link useViewportClass}). Χωρίς αυτήν, το
 *    στρώμα 2 θα ήταν **διακοσμητικό**: ένα `boolean` που ξεκινά `false` σημαίνει
 *    «ευρεία» στο πρώτο καρέ, η εισαγωγή ξεκινά, και **μια εισαγωγή που ξεκίνησε δεν
 *    ακυρώνεται**. Τα bytes θα είχαν φύγει πριν το `useEffect` πει «στενή».
 *
 * 🏆 **Το πρότυπο είναι το BIMx** (Α8, §18): ο θεατής είναι **ΑΛΛΟ ΠΡΟΪΟΝ**, όχι
 * απλοποιημένη έκδοση της σύνταξης. Άρα η στενή οθόνη **δεν** παίρνει μικρότερη
 * φόρμα — παίρνει **γραπτή εξήγηση** και τον δρόμο προς ό,τι *μπορεί* να κάνει εδώ.
 *
 * ⚠️ **Το `ssr: false` δεν είναι βελτιστοποίηση — είναι ορθότητα.** Στον διακομιστή
 * δεν υπάρχει παράθυρο, άρα δεν υπάρχει απάντηση στο «πόσο πλατύ;»· ένα SSR της
 * φόρμας θα έστελνε **σε όλους** ακριβώς ό,τι αυτό το αρχείο υπάρχει για να μη σταλεί.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useViewportClass } from '@/hooks/media/useViewportClass';
import { MY_DEMANDS_ROUTE } from '@/lib/demand/demand-routes';
import type { DemandFormContentProps } from './DemandFormContent';

const NS = 'search-results';

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

/** Τι *μπορεί* να κάνει εδώ ο άνθρωπος με στενή οθόνη — ποτέ σκέτη άρνηση. */
function DesktopOnlyNotice(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const K = `${NS}:demand.desktopOnly`;

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <h1 className="text-xl font-semibold text-foreground">{t(`${K}.title`)}</h1>
      <p className="text-sm text-foreground">{t(`${K}.body`)}</p>
      <p className="text-sm text-muted-foreground">{t(`${K}.what`)}</p>
      <nav>
        <Link
          href={MY_DEMANDS_ROUTE}
          className="inline-block rounded-md border border-border px-4 py-2 font-medium text-foreground"
        >
          {t(`${K}.back`)}
        </Link>
      </nav>
    </section>
  );
}

export function DemandCreationGate(props: DemandFormContentProps): React.ReactElement {
  const viewport = useViewportClass();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      {/*
        🔴 Το `measuring` ζωγραφίζει **τίποτα**, όχι τη φόρμα και όχι την ειδοποίηση.
        Και τα δύο θα ήταν ισχυρισμός για κάτι που ακόμη δεν ξέρουμε: το πρώτο στέλνει
        τα bytes, το δεύτερο λέει «δεν γίνεται» σε άνθρωπο με οθόνη 27 ιντσών. Η μία
        στιγμή κενού είναι ο **μόνος** ειλικρινής καρές.
      */}
      {viewport === 'wide' && <DemandFormContent {...props} />}
      {viewport === 'narrow' && <DesktopOnlyNotice />}
    </main>
  );
}
