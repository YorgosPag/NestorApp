/**
 * =============================================================================
 * Η ΕΜΦΑΝΙΣΗ ΤΗΣ ΟΘΟΝΗΣ ΡΥΘΜΙΣΕΩΝ ΕΙΔΟΠΟΙΗΣΕΩΝ — ΕΝΑ σημείο (ADR-849 Α3)
 * =============================================================================
 *
 * Κάθε υπο-component της οθόνης (γραμμή μήτρας, κεφαλίδα ομάδας, επιλογέας, καθολικός διακόπτης…)
 * ζητούσε **τα ίδια** πέντε design hooks και τη μετάφραση — δεκάδες πανομοιότυπες γραμμές, που το
 * jscpd (CHECK 3.28) έπιασε ως δίδυμα μπλοκ ανάμεσα σε `NotificationSettings` και μήτρα. Εδώ ζουν
 * **μία** φορά· τα components παίρνουν ό,τι χρειάζονται με αποδόμηση.
 *
 * 🔑 Τα design hooks επιστρέφουν σταθερά λεξικά κλάσεων (ADR-128) — η κλήση όσων δεν χρησιμοποιεί
 * ένα component δεν κοστίζει απόδοση.
 *
 * @module components/account/useNotificationSettingsUi
 * @see ADR-849
 */

import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function useNotificationSettingsUi() {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const colors = useSemanticColors();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const borders = useBorderTokens();
  return { t, colors, layout, iconSizes, typography, borders };
}

export type NotificationSettingsUi = ReturnType<typeof useNotificationSettingsUi>;
