import '@/lib/design-system';
import { Filter, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ContactFilterIndicatorProps {
  filterParam: string | null;
  /**
   * Ο χρήστης ήρθε από σύνδεσμο άλλης ενότητας (και **δεν** έχει αλλάξει επιλογή).
   *
   * ⚠️ Ήταν `contactIdParam: string | null`. Από το ADR-332 D21 το `?contactId=`
   * υπάρχει σε **κάθε** επιλογή — αν το banner κρεμόταν από αυτό, θα εμφανιζόταν σε
   * κάθε κλικ. Το ερώτημα που πραγματικά απαντά το banner δεν ήταν ποτέ «είναι κάτι
   * επιλεγμένο;» αλλά «χρειάζεται ο χρήστης δρόμο επιστροφής;».
   */
  arrivedViaDeepLink: boolean;
  contactName: string | null;
  filteredCount: number;
  onClear: () => void;
}

/**
 * Filter indicator banner shown on a `?filter=` search or a deep-link arrival.
 * Extracted from ContactsPageContent for SRP compliance (ADR-233).
 */
export function ContactFilterIndicator({
  filterParam,
  arrivedViaDeepLink,
  contactName,
  filteredCount,
  onClear,
}: ContactFilterIndicatorProps) {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { getDirectionalBorder } = useBorderTokens();

  if (!filterParam && !arrivedViaDeepLink) return null;

  // Priority: a deep-link arrival whose contact has resolved to a name
  if (arrivedViaDeepLink && contactName) {
    return (
      <div className={`px-4 py-2 ${colors.bg.success} ${getDirectionalBorder('success', 'bottom')}`}>
        <div className="flex items-center justify-between max-w-full">
          <div className="flex items-center space-x-2">
            <Filter className={`${iconSizes.sm} ${colors.text.success}`} />
            <span className={`text-sm ${colors.text.success}`}>
              {t('page.filterIndicator.viewingCustomer')} <strong>{contactName}</strong>
            </span>
            <span className={`text-xs ${colors.text.success} ${colors.bg.successSubtle} px-2 py-1 rounded`}>
              {t('page.filterIndicator.selectedContact')}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClear}
                className={`flex items-center space-x-1 px-2 py-1 text-sm ${colors.text.success} rounded ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_GHOST}`}
              >
                <X className={iconSizes.sm} />
                <span>{t('page.filterIndicator.back')}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('page.filterIndicator.backToList')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  // Fallback: general filter banner
  if (filterParam) {
    const filterValue = decodeURIComponent(filterParam);
    return (
      <div className={`px-4 py-2 ${colors.bg.info} ${getDirectionalBorder('info', 'bottom')}`}>
        <div className="flex items-center justify-between max-w-full">
          <div className="flex items-center space-x-2">
            <Filter className={`${iconSizes.sm} ${colors.text.info}`} />
            <span className={`text-sm ${colors.text.info}`}>
              {t('page.filterIndicator.filteringFor')} <strong>&ldquo;{filterValue}&rdquo;</strong>
            </span>
            <span className={`text-xs ${colors.text.info} ${colors.bg.infoSubtle} px-2 py-1 rounded`}>
              {filteredCount === 1
                ? t('page.filterIndicator.contactsCount', { count: filteredCount })
                : t('page.filterIndicator.contactsCountPlural', { count: filteredCount })}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClear}
                className={`flex items-center space-x-1 px-2 py-1 text-sm ${colors.text.info} rounded ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_GHOST}`}
              >
                <X className={iconSizes.sm} />
                <span>{t('page.filterIndicator.clear')}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('page.filterIndicator.showAll')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  return null;
}
