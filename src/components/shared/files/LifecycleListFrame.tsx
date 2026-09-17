/**
 * LifecycleListFrame — το **ένα** πλαίσιο λίστας κύκλου ζωής (κάδος · αρχειοθήκη):
 * φόρτωση · σφάλμα · κενή κατάσταση · κεφαλίδα με ανανέωση.
 *
 * 🧹 **Εξήχθη με μέτρηση (CHECK 3.28, ADR-866 §2.6.8)**: `TrashView` και `ArchiveView` ήταν δίδυμα
 * σε σκελετό φόρτωσης (32 γρ.), μήνυμα σφάλματος, κενή κατάσταση και κεφαλίδα — διέφεραν μόνο σε
 * εικονίδιο και κλειδιά κειμένου. Φάνηκε όταν ο κάτοχος έγινε «εταιρεία Ή άνθρωπος» και άγγιξε
 * **και τα δύο** στο ίδιο commit.
 *
 * @module components/shared/files/LifecycleListFrame
 */

'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Calendar, HardDrive, RefreshCw, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFilesNotifications } from '@/hooks/notifications/useFilesNotifications';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateTime } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import type { FileRecord } from '@/types/file-record';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatFileSize } from '@/utils/file-validation';
import '@/lib/design-system';

/**
 * **Τα κοινά εργαλεία προβολής** των λιστών κύκλου ζωής — ίδια σειρά hooks στον κάδο και στην
 * αρχειοθήκη (ήταν δίδυμος πρόλογος, CHECK 3.28).
 */
export function useLifecycleViewKit() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation(['files', 'files-media']);
  const translateDisplayName = useFileDisplayName();
  const fileNotifications = useFilesNotifications();
  return { iconSizes, quick, colors, t, translateDisplayName, fileNotifications };
}

/** Ημερομηνία γραμμής λίστας — `N/A` όταν λείπει ή δεν αναλύεται (ήταν δίδυμο `formatTrashDate`/`formatArchiveDate`). */
export function formatLifecycleDate(dateInput: string | Date | undefined): string {
  if (!dateInput) return 'N/A';
  const formatted = formatDateTime(dateInput);
  return formatted === '-' ? 'N/A' : formatted;
}

/** Τα στατιστικά της λίστας — πλήθος και συνολικό μέγεθος. */
export function LifecycleListStats({
  files,
  countLabel,
  sizeLabel,
}: {
  readonly files: readonly FileRecord[];
  readonly countLabel: string;
  readonly sizeLabel: string;
}) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const totalBytes = files.reduce((total, f) => total + (f.sizeBytes || 0), 0);

  return (
    <div className="flex gap-2 text-sm">
      <span className={cn('flex items-center gap-1', colors.text.muted)}>
        <HardDrive className={iconSizes.xs} />
        {countLabel}: {files.length}
      </span>
      <span className={cn('flex items-center gap-1', colors.text.muted)}>
        <HardDrive className={iconSizes.xs} />
        {sizeLabel}: {formatFileSize(totalBytes)}
      </span>
    </div>
  );
}

/** Χρωματικός τόνος του εικονιδίου γραμμής — ο κάδος «κινδυνεύει», η αρχειοθήκη «προσέχει». */
const ROW_TONES = {
  destructive: { box: 'bg-destructive/10', icon: 'text-destructive' },
  warning: { box: 'bg-[hsl(var(--bg-warning))]/10', icon: 'text-[hsl(var(--text-warning))]' },
} as const;

interface LifecycleFileRowProps {
  readonly file: FileRecord;
  readonly icon: LucideIcon;
  readonly tone: keyof typeof ROW_TONES;
  /** Η ημερομηνία της γραμμής, ήδη με ετικέτα (π.χ. «Στον κάδο: …»). */
  readonly dateText: string;
  /** Επιπλέον μεταδεδομένα (λήξη κάδου, δέσμευση) — μετά την ημερομηνία. */
  readonly extraMeta?: React.ReactNode;
  readonly actionLabel: string;
  readonly actionText: string;
  readonly onAction: () => void;
}

/** **Μία** γραμμή αρχείου κύκλου ζωής: εικονίδιο · όνομα · μέγεθος · ημερομηνία · ενέργεια επαναφοράς. */
export function LifecycleFileRow(props: LifecycleFileRowProps) {
  const { iconSizes, quick, colors, t, translateDisplayName } = useLifecycleViewKit();
  const { file, icon: Icon, tone, actionLabel } = props;
  const displayName = translateDisplayName(file);

  return (
    <article
      className={`flex items-center justify-between p-2 bg-card ${quick.card} border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
      role="listitem"
      aria-label={`${t('list.file')}: ${displayName}`}
    >
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div className={`flex-shrink-0 w-10 h-10 ${ROW_TONES[tone].box} ${quick.card} flex items-center justify-center`} aria-hidden="true">
          <Icon className={`${iconSizes.md} ${ROW_TONES[tone].icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
          <div className={cn('flex flex-wrap items-center gap-2 text-xs mt-1', colors.text.muted)}>
            <span className="flex items-center gap-1">
              <HardDrive className={iconSizes.xs} aria-hidden="true" />
              {formatFileSize(file.sizeBytes ?? 0)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className={iconSizes.xs} aria-hidden="true" />
              {props.dateText}
            </span>
            {props.extraMeta}
          </div>
        </div>
      </div>
      <nav className="flex items-center space-x-1" role="toolbar" aria-label={t('list.fileActions')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onAction}
              className="text-[hsl(var(--text-success))] hover:text-[hsl(var(--text-success))] hover:bg-[hsl(var(--bg-success))]/10"
              aria-label={actionLabel}
            >
              <RotateCcw className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
              {props.actionText}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{actionLabel}</TooltipContent>
        </Tooltip>
      </nav>
    </article>
  );
}

interface LifecycleListHeaderProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description?: string;
  /** Απουσία ⇒ κανένα κουμπί ανανέωσης (π.χ. στον σκελετό φόρτωσης). */
  readonly onRefresh?: () => void;
}

/** Η κεφαλίδα της λίστας — εικονίδιο, τίτλος, προαιρετική περιγραφή και ανανέωση. */
export function LifecycleListHeader({ icon: Icon, title, description, onRefresh }: LifecycleListHeaderProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(['files', 'files-media']);

  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={cn(iconSizes.md, colors.text.muted)} />
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className={cn('text-xs', colors.text.muted)}>{description}</p>}
        </div>
      </div>
      {onRefresh && (
        <Button variant="ghost" size="sm" onClick={onRefresh} aria-label={t('manager.refresh')}>
          <RefreshCw className={iconSizes.sm} />
        </Button>
      )}
    </header>
  );
}

function LoadingSkeleton({ icon, title }: { readonly icon: LucideIcon; readonly title: string }) {
  const { quick } = useBorderTokens();
  const { t } = useTranslation(['files', 'files-media']);

  return (
    <section className="space-y-2" role="status" aria-label={t('list.loadingFiles')}>
      <LifecycleListHeader icon={icon} title={title} />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`p-2 bg-card ${quick.card} border animate-pulse`} aria-hidden="true">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 bg-muted ${quick.card}`} />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ErrorState({ error, onRefresh }: { readonly error: Error; readonly onRefresh: () => void }) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation(['files', 'files-media']);

  return (
    <section className={`p-2 ${colors.bg.error} ${quick.card} border border-destructive`}>
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className={iconSizes.md} />
        <p>{error.message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} className="mt-2">
        <RefreshCw className={`${iconSizes.sm} mr-2`} />
        {t('manager.refresh')}
      </Button>
    </section>
  );
}

interface LifecycleListFrameProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly loading: boolean;
  readonly error: Error | null;
  readonly isEmpty: boolean;
  readonly onRefresh: () => void;
  /** Η γεμάτη λίστα — αποδίδεται **μόνο** όταν δεν φορτώνει, δεν απέτυχε και δεν είναι κενή. */
  readonly children: React.ReactNode;
}

/** Φόρτωση → σφάλμα → κενή → γεμάτη λίστα, με αυτή τη σειρά. */
export function LifecycleListFrame(props: LifecycleListFrameProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { icon: Icon, title, emptyTitle, emptyDescription, onRefresh } = props;

  if (props.loading) return <LoadingSkeleton icon={Icon} title={title} />;
  if (props.error) return <ErrorState error={props.error} onRefresh={onRefresh} />;
  if (!props.isEmpty) return <>{props.children}</>;

  return (
    <section className="space-y-2">
      <LifecycleListHeader icon={Icon} title={title} onRefresh={onRefresh} />
      <div className={`p-2 text-center ${colors.bg.muted} ${quick.card}`} role="status" aria-label={emptyTitle}>
        <Icon className={`${iconSizes.xl} mx-auto mb-2 ${colors.text.muted}`} />
        <p className="text-sm font-medium">{emptyTitle}</p>
        <p className={cn('text-xs mt-1', colors.text.muted)}>{emptyDescription}</p>
      </div>
    </section>
  );
}
