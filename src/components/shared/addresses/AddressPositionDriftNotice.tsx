'use client';

/**
 * @fileoverview **Η ΠΙΝΕΖΑ ΑΠΕΧΕΙ ΑΠΟ ΤΗ ΝΕΑ ΔΙΕΥΘΥΝΣΗ** — ADR-332 D27 Βήμα Β (Φ2β).
 * @related lib/geocoding/address-position (`human-kept` · `drift`)
 *
 * Όταν αλλάζει το κείμενο μιας διεύθυνσης, η πινέζα που έβαλε ο άνθρωπος **μένει** — πρακτική
 * Revit (η αλλαγή διεύθυνσης δεν μετακινεί την πινέζα), Apple Maps, Salesforce Verified. Εκεί
 * όμως η μπαγιάτικη θέση μένει **σιωπηλά**. Εδώ ο διακομιστής **μετρά** την απόκλιση από τη
 * θέση της νέας διεύθυνσης και, μόνο όταν ξεπερνά την αβεβαιότητα της μηχανής, το λέμε.
 *
 * 🔑 **Μη-μπλοκαριστική**: τίποτα δεν περιμένει την απάντηση. «Κράτα» = ο άνθρωπος ξέρει καλύτερα
 * (η είσοδος δεν είναι το κέντρο του κτιρίου). «Μετακίνησε» = ρητή δήλωση `relocate` — όχι παρενέργεια.
 */

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatGeoDistance } from '@/lib/geo/format-geo-distance';

export interface AddressPositionDriftNoticeProps {
  /** Μετρημένη απόσταση πινέζας ↔ θέσης της νέας διεύθυνσης (μέτρα). */
  readonly distanceMetres: number;
  readonly onRelocate: () => void;
  readonly onKeep: () => void;
  /** Αποθήκευση σε εξέλιξη — τα κουμπιά παγώνουν, το μήνυμα μένει. */
  readonly busy?: boolean;
}

export function AddressPositionDriftNotice({
  distanceMetres,
  onRelocate,
  onKeep,
  busy = false,
}: AddressPositionDriftNoticeProps) {
  const { t, currentLanguage } = useTranslation('addresses');
  // Η απόσταση από τον ΕΝΑ μορφοποιητή (κλίμακα Google Maps, Intl) — ποτέ δεύτερος.
  const distance = formatGeoDistance(distanceMetres, currentLanguage) ?? '';

  return (
    <section role="status" aria-live="polite" className="mt-2 space-y-2 border-t pt-2 text-sm">
      <p className="text-[hsl(var(--text-warning))]">{t('editor.positionDrift.message', { distance })}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRelocate}>
          {t('editor.positionDrift.relocate')}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onKeep}>
          {t('editor.positionDrift.keep')}
        </Button>
      </div>
    </section>
  );
}
