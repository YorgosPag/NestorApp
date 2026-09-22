'use client';

import type { LucideIcon } from 'lucide-react';
import { CloudCheck, CloudOff, CloudUpload, WifiOff } from 'lucide-react';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSaveStatus, type SaveStatus } from '@/hooks/useSaveStatus';
import { cn } from '@/lib/utils';

/**
 * Η ένδειξη «τι γίνεται με τις αλλαγές μου» στην κεφαλίδα (ADR-367 §2.7 — πρότυπο Google Docs).
 *
 * 🔑 **ΕΙΚΟΝΙΔΙΟ + ΚΕΙΜΕΝΟ ανά κατάσταση, όχι μόνο χρώμα** (CHECK 3.41): ξέρεις ποια είναι ποια
 * χωρίς να δεις χρώμα.
 * 🔑 **Το live region ζει ΠΑΝΤΑ**: ένα `role="status"` που γεννιέται μαζί με το πρώτο του μήνυμα
 * δεν ανακοινώνεται αξιόπιστα. Γι' αυτό το ορατό chip είναι `aria-hidden` και εμφανίζεται μόνο
 * όταν έχει κάτι να πει, ενώ ο αναγνώστης οθόνης ακούει από ένα `sr-only` που δεν φεύγει ποτέ
 * (και, ως `absolute`, δεν πιάνει θέση στη διάταξη της κεφαλίδας).
 * 🔑 **Πέρα από το Docs**: εκτός σύνδεσης το Docs κρατά τις αλλαγές στον δίσκο· εμείς (ADR-367
 * §2.5) τις κρατάμε στην καρτέλα — άρα το tooltip λέει ρητά **«μην κλείσετε την καρτέλα»**.
 */

type VisibleStatus = Exclude<SaveStatus, 'idle'>;
type Translate = ReturnType<typeof useTranslation>['t'];

interface StatusPresentation {
  readonly icon: LucideIcon;
  readonly tone: string;
  readonly iconClassName?: string;
}

interface StatusText {
  readonly label: string;
  readonly hint: string;
}

const PRESENTATION: Record<VisibleStatus, StatusPresentation> = {
  saving: { icon: CloudUpload, tone: 'text-muted-foreground', iconClassName: 'motion-safe:animate-pulse' },
  saved: { icon: CloudCheck, tone: 'text-[hsl(var(--text-success))]' },
  offline: { icon: WifiOff, tone: 'text-muted-foreground' },
  'offline-pending': { icon: CloudOff, tone: 'text-[hsl(var(--text-warning))]' },
};

/**
 * ⚠️ ΣΤΑΘΕΡΑ κλειδιά, ΟΧΙ `t(map[status])`: η κεφαλίδα ζει στο κέλυφος, και η γεννήτρια του
 * shell slice (CHECK 3.34, ADR-744) **αρνείται** ανεπίλυτα δυναμικά `t()` εκεί.
 */
function statusText(t: Translate, status: VisibleStatus): StatusText {
  switch (status) {
    case 'saving':
      return { label: t('saveStatus.saving'), hint: t('saveStatus.savingHint') };
    case 'saved':
      return { label: t('saveStatus.saved'), hint: t('saveStatus.savedHint') };
    case 'offline':
      return { label: t('saveStatus.offline'), hint: t('saveStatus.offlineHint') };
    case 'offline-pending':
      return { label: t('saveStatus.offlinePending'), hint: t('saveStatus.offlinePendingHint') };
  }
}

export function SaveStatusIndicator() {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const status = useSaveStatus();
  const visible = status === 'idle' ? null : status;
  const text = visible ? statusText(t, visible) : null;
  const presentation = visible ? PRESENTATION[visible] : null;

  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {text ? `${text.label}. ${text.hint}` : ''}
      </span>
      {presentation && text && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              aria-hidden="true"
              className={cn('flex items-center gap-1.5 px-2 text-xs font-medium', presentation.tone)}
            >
              <presentation.icon className={cn('h-4 w-4 shrink-0', presentation.iconClassName)} />
              <span className="hidden md:inline">{text.label}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>{text.hint}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
