'use client';

/**
 * ⚖️ **ΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ** — ο φορέας παροχής της υπηρεσίας (ADR-861 Φ2).
 *
 * Π.Δ. 131/2003 άρθ. 4 (μεταφορά της Οδηγίας 2000/31/ΕΚ άρθ. 5): ο φορέας οφείλει «εύκολη, άμεση
 * και συνεχή πρόσβαση» σε επωνυμία · γεωγραφική διεύθυνση · στοιχεία ταχείας επικοινωνίας με email ·
 * μητρώο · ΑΦΜ. Η σελίδα **δεν γράφει κανένα στοιχείο**: τα αποδίδει το `OperatorIdentityStatement`
 * από τη ρίζα του φορέα. Ισοδύναμο των «Impressum»/«Legal notice» των μεγάλων (Google · Stripe).
 *
 * ⚠️ Ίδια δομή με τις τρεις αδελφές νομικές οθόνες — `ShellSurface measure="prose"` (ADR-816) και
 * route slice σε εμβέλεια module (ADR-744 §18: ποτέ `import()`, ποτέ Server Component).
 * 🔴 Το `legal-notice.el.json` **παράγεται** από το `npm run generate:i18n-shell-slice` — μέχρι να
 * τρέξει (μόνο με εντολή Giorgio) η εισαγωγή δεν λύνεται.
 */

import '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import routeSlice from '@/i18n/generated/routes/legal-notice.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { ShellSurface } from '@/core/containers/ShellSurface';
import { LegalLinksNav } from '@/components/legal/LegalLinksNav';
import { OperatorIdentityStatement } from '@/components/legal/OperatorIdentityStatement';

registerRouteSlice(routeSlice);

export default function LegalNoticePage() {
  const { t } = useTranslation('legal');

  return (
    <ShellSurface measure="prose">
      <h1>{t('legalNotice.title')}</h1>
      <p>{t('legalNotice.intro')}</p>

      <h2>{t('legalNotice.operatorTitle')}</h2>
      <OperatorIdentityStatement />

      <h2>{t('legalNotice.documentsTitle')}</h2>
      <LegalLinksNav variant="prose" current="legalNotice" />
    </ShellSurface>
  );
}
