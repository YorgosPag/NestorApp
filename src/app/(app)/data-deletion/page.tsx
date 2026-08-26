'use client';

import '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
// Χωρίς αυτές τις δύο γραμμές το artifact υπάρχει, το manifest το υπογράφει, οι πύλες
// είναι πράσινες — και **κανείς δεν το φορτώνει ποτέ**: η θεραπεία μένει ΑΔΡΑΝΗΣ.
// ⚠️ ΠΟΤΕ `import()` (μετακινεί το ωμό κλειδί σε «ένα καρέ» και το κρύβει από το
// CHECK 3.51)· ΠΟΤΕ σε Server Component (ξεχωριστός γράφος module ⇒ γράφει σε άλλο
// στιγμιότυπο i18next)· η εισαγωγή του `route-slice` περνά από το `./config`, άρα ο
// bootstrap του i18next έχει τελειώσει όταν τρέξει η κλήση.
import routeSlice from '@/i18n/generated/routes/data-deletion.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
// 🔴 ADR-816 — Ο ΙΔΙΟΚΤΗΤΗΣ ΤΗΣ ΓΕΩΜΕΤΡΙΑΣ, ΟΧΙ Η ΣΕΛΙΔΑ.
// Το `max-w-3xl mx-auto px-4 py-8` που ήταν εδώ ήταν **τρία** χειρόγραφα:
// ταβάνι πλάτους, κεντράρισμα, διάδρομος — και τα τρία τα κατέχει το κέλυφος
// (CHECK 3.63). Επιπλέον το `<main>` της σελίδας ήταν **ΤΡΙΤΟ** landmark:
// μετρημένο ζωντανά, το `(app)` αποδίδει ήδη δύο (`SidebarInset` και
// `MainContentBridge`) ενώ το WCAG επιτρέπει **ένα**.
// ⚠️ Το `measure="prose"` ΔΕΝ είναι μόνο πλάτος: φέρνει και την τυπογραφία του
// σκέλους 4 του WCAG 1.4.8 (διάστιχο ≥1,5 · απόσταση παραγράφων ≥1,5× αυτού),
// που εδώ έλειπε — μετρημένο 24px αντί για 36px ανάμεσα σε παραγράφους.
import { ShellSurface } from '@/core/containers/ShellSurface';

registerRouteSlice(routeSlice);

export default function DataDeletionPage() {
  const { t } = useTranslation('legal');

  return (
    <ShellSurface measure="prose">
      <h1>{t('dataDeletion.title')}</h1>
      <p>
        <strong>{t('dataDeletion.lastUpdated')}</strong> {t('dataDeletion.lastUpdatedDate')}
      </p>

      <h2>{t('dataDeletion.howToRequest.title')}</h2>
      <p>{t('dataDeletion.howToRequest.intro')}</p>

      <ol>
        <li dangerouslySetInnerHTML={{ __html: t('dataDeletion.howToRequest.step1') }} />
        <li>{t('dataDeletion.howToRequest.step2')}</li>
        <li>{t('dataDeletion.howToRequest.step3')}</li>
      </ol>

      <h2>{t('dataDeletion.whatWeDelete.title')}</h2>
      <ul>
        <li>{t('dataDeletion.whatWeDelete.item1')}</li>
        <li>{t('dataDeletion.whatWeDelete.item2')}</li>
        <li>{t('dataDeletion.whatWeDelete.item3')}</li>
      </ul>

      <h2>{t('dataDeletion.contact.title')}</h2>
      <p dangerouslySetInnerHTML={{ __html: t('dataDeletion.contact.text') }} />
    </ShellSurface>
  );
}
