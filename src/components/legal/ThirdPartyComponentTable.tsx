'use client';

/**
 * @fileoverview ⚖️ **Ο ΚΑΤΑΛΟΓΟΣ ΤΩΝ ΣΤΟΙΧΕΙΩΝ ΑΝΟΙΧΤΟΥ ΚΩΔΙΚΑ** — τεμπέλικα (ADR-863 Φ3).
 * @related lib/legal/third-party-index.ts · components/legal/ThirdPartyAttribution.tsx
 * @module components/legal/ThirdPartyComponentTable
 *
 * 🔑 **ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΟΝΟΜΑΣΜΕΝΕΣ — ΠΟΤΕ ΔΥΟ ΜΕ «Ή»**: *φορτώνω* · *ρώτησα και δεν
 * έμαθα* · *ο κατάλογος*. Η δεύτερη **δεν** επιτρέπεται να μοιάζει με την τρίτη: ένας
 * κενός πίνακας θα έλεγε «δεν χρησιμοποιούμε τίποτα», που είναι ψέμα σε δημόσιο έγγραφο.
 *
 * ⚠️ **ΚΑΜΙΑ ΕΙΚΟΝΙΚΟΠΟΙΗΣΗ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.** 1.071 γραμμές είναι πολλές για DOM,
 * αλλά μια βιβλιοθήκη virtualization θα ήταν **νέα εξάρτηση** — δηλαδή νέα γραμμή σε
 * αυτόν ακριβώς τον πίνακα, για να ζωγραφιστεί ο πίνακας. Το Figma και το Slack
 * αποδίδουν τις δικές τους λίστες ολόκληρες, σε σελίδα που ανοίγει σπάνια.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLazySnapshot } from '@/hooks/useLazySnapshot';
import {
  EMPTY_THIRD_PARTY_INDEX,
  THIRD_PARTY_INDEX_SOURCE,
  type ThirdPartyComponent,
  type ThirdPartySurface,
} from '@/lib/legal/third-party-index';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Ρητός χάρτης — ο γεννήτορας του route slice λύνει τις τιμές του.
 *
 * ⚠️ **Σκέτο `as const`, ΟΧΙ `satisfies`**: ο γεννήτορας ξετυλίγει μόνο `AsExpression`
 * (`key-tables.js`)· με `satisfies` το slice **αρνείται** να εκπέμψει — μετρημένο
 * 2026-09-16 στο `LegalLinksNav`. Η πληρότητα τη φυλά ο τύπος: `SURFACE_KEYS[surface]`
 * με `surface: ThirdPartySurface` δεν μεταγλωττίζεται αν λείπει κλειδί.
 */
const SURFACE_KEYS = {
  browser: 'openSource.surface.browser',
  server: 'openSource.surface.server',
  unknown: 'openSource.surface.unknown',
} as const;

/**
 * 🔴 **ΟΙ ΚΕΦΑΛΙΔΕΣ ΓΡΑΦΟΝΤΑΙ ΡΗΤΑ, ΜΙΑ-ΜΙΑ — ΚΑΙ ΤΟ ΕΠΙΒΑΛΛΕΙ Ο ΓΕΝΝΗΤΟΡΑΣ.**
 *
 * Η πρώτη γραφή ήταν `COLUMN_KEYS.map((key) => t(key))`. Ο εξαγωγέας κλειδιών
 * (`key-extract.js`) επιλύει **συμβολοσειρά** · **ευρετήριο σε χάρτη** (`MAP[x]`) ·
 * **όνομα με γνωστή τιμή** — **ποτέ παράμετρο βρόχου**. Μετρημένο 2026-09-16: ο
 * γεννήτορας **ΑΡΝΗΘΗΚΕ** να εκπέμψει ολόκληρο το slice της διαδρομής, και **8 κλειδιά
 * έμειναν χωρίς namespace**.
 *
 * ⚠️ **Η ΘΕΡΑΠΕΙΑ ΔΕΝ ΕΙΝΑΙ ΕΓΓΡΑΦΗ ΣΤΟ `dynamicKeyPolicy`.** Εκείνο υπάρχει για κλειδιά
 * που γεννιούνται **σε χρόνο εκτέλεσης** (ρυθμίσεις, δεδομένα). Εδώ τα τέσσερα κλειδιά
 * είναι **απολύτως στατικά**: μια δήλωση policy θα έλεγε στο εργαλείο «μην κοιτάς» για
 * κάτι που μπορεί να δει τέλεια. Είναι το ίδιο ιδίωμα με το `OperatorIdentityStatement`,
 * που γράφει κάθε ετικέτα ρητά.
 */

function ComponentRow({ component }: { readonly component: ThirdPartyComponent }): React.JSX.Element {
  const { t } = useTranslation('legal');
  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{component.name}</TableCell>
      <TableCell>{component.version}</TableCell>
      {/* ⚠️ Το αναγνωριστικό SPDX μένει ΑΜΕΤΑΦΡΑΣΤΟ: είναι ονομασία προτύπου, όχι κείμενο. */}
      <TableCell>{component.license}</TableCell>
      <TableCell>{t(SURFACE_KEYS[component.surface])}</TableCell>
    </TableRow>
  );
}

/**
 * Ο πίνακας, ή η **ονομασμένη** κατάσταση που δεν είναι πίνακας.
 *
 * ⚠️ Το `useLazySnapshot` επιστρέφει `null` **μόνο** όσο δεν ξέρουμε ακόμη· μετά από
 * αποτυχία δίνει το κενό στιγμιότυπο, ώστε η οθόνη να **σταματήσει** να λέει «φορτώνω».
 */
export function ThirdPartyComponentTable(): React.JSX.Element {
  const { t } = useTranslation('legal');
  const index = useLazySnapshot(THIRD_PARTY_INDEX_SOURCE, EMPTY_THIRD_PARTY_INDEX);

  if (index === null) return <p>{t('openSource.loading')}</p>;
  if (index.components.length === 0) return <p>{t('openSource.unavailable')}</p>;

  return (
    <>
      <p>{t('openSource.total', { count: String(index.components.length) })}</p>
      {index.measured ? null : <p>{t('openSource.unmeasuredIntro')}</p>}
      <Table size="compact">
        <TableCaption>{t('openSource.tableCaption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t('openSource.columns.name')}</TableHead>
            <TableHead>{t('openSource.columns.version')}</TableHead>
            <TableHead>{t('openSource.columns.license')}</TableHead>
            <TableHead>{t('openSource.columns.surface')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {index.components.map((component) => (
            <ComponentRow key={`${component.name}@${component.version}`} component={component} />
          ))}
        </TableBody>
      </Table>
    </>
  );
}

export type { ThirdPartySurface };
