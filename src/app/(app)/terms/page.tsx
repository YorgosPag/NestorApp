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
import routeSlice from '@/i18n/generated/routes/terms.el.json';
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

export default function TermsOfServicePage() {
  const { t } = useTranslation('legal');

  return (
    <ShellSurface measure="prose">
      <h1>{t('termsOfService.title')}</h1>
      <p>
        <strong>{t('termsOfService.lastUpdated')}</strong> {t('termsOfService.lastUpdatedDate')}
      </p>

      <h2>{t('termsOfService.acceptance.title')}</h2>
      <p>{t('termsOfService.acceptance.content')}</p>

      <h2>{t('termsOfService.services.title')}</h2>
      <p>{t('termsOfService.services.content')}</p>

      <h2>{t('termsOfService.userResponsibilities.title')}</h2>
      <ul>
        <li>{t('termsOfService.userResponsibilities.item1')}</li>
        <li>{t('termsOfService.userResponsibilities.item2')}</li>
        <li>{t('termsOfService.userResponsibilities.item3')}</li>
      </ul>

      <h2>{t('termsOfService.limitation.title')}</h2>
      <p>{t('termsOfService.limitation.content')}</p>

      <h2>{t('termsOfService.changes.title')}</h2>
      <p>{t('termsOfService.changes.content')}</p>

      <h2>{t('termsOfService.contact.title')}</h2>
      <p dangerouslySetInnerHTML={{ __html: t('termsOfService.contact.text') }} />
    </ShellSurface>
  );
}
