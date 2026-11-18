'use client';

/**
 * @fileoverview **Αλλαγή εύρους · Ανανέωση** μιας ενεργής συμμετοχής στον φάκελο (ADR-916 Φ-Ε1 Σ4).
 * @module components/property-dossier/access/DossierEngagementDialogs
 * @related `DossierAccessFields.tsx` (τα ΙΔΙΑ πεδία με την πρόσκληση) · `POST …/access/[engagementId]`
 *
 * 🔑 Ο διάλογος ξεκινά από την **τρέχουσα** αλήθεια της συμμετοχής (εύρος · διάρκεια) και στέλνει **μόνο** τη νέα τιμή·
 *    ίδια τιμή ⇒ ο ΕΝΑΣ γραφέας απαντά `noop` (κανένα ίχνος, καμία ειδοποίηση).
 */

import React, { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { dossierRenewalShortensByDays, dossierShareExpiresAt, type DossierShareDays } from '@/config/engagement-policy';
import { PROFILE_HOLIDAY_KEYS } from '@/components/mandate/agency-directory-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nonBusinessDayReason } from '@/lib/calendar/business-days';
import { athensClockAt } from '@/lib/calendar/weekly-hours';
import { formatCalendarDay, formatIsoWeekday } from '@/lib/intl-formatting';
import type { FloorplanTabKind } from '@/lib/property-dossier/property-dossier-view';
import type { DossierEngagementSummary } from '@/types/dossier-access';
import type { DossierShareReach } from '@/types/engagement';
import type { EngagedDossierFile } from '@/types/my-engagements';

import { DossierReachFields, DossierShareDaysField } from './DossierAccessFields';

const K = 'property-market:dossier.access';

/** Το κέλυφος των δύο διαλόγων — ανοιχτό όσο υπάρχει συμμετοχή-στόχος. */
function EngagementDialog({ title, description, onCancel, children }: {
  readonly title: string;
  readonly description: string;
  readonly onCancel: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

interface ReachDialogProps {
  readonly engagement: DossierEngagementSummary | null;
  readonly floorplanKind: FloorplanTabKind;
  readonly files: readonly EngagedDossierFile[];
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onSave: (engagement: DossierEngagementSummary, reach: DossierShareReach) => void;
}

function ReachForm({ engagement, floorplanKind, files, busy, onCancel, onSave }: ReachDialogProps & { readonly engagement: DossierEngagementSummary }) {
  const { t } = useTranslation(['property-market']);
  const [reach, setReach] = useState<DossierShareReach>(engagement.reach);
  return (
    <>
      <DossierReachFields idPrefix="dossier-reach" floorplanKind={floorplanKind} files={files} reach={reach} onChange={setReach} />
      <DialogActionFooter
        cancelLabel={t(`${K}.invite.cancel`)}
        confirmLabel={t(`${K}.reachDialog.save`)}
        busyLabel={t(`${K}.reachDialog.saving`)}
        onCancel={onCancel}
        onConfirm={() => onSave(engagement, reach)}
        isSubmitting={busy}
        canSubmit={!busy && reach.tabs.length > 0}
      />
    </>
  );
}

export function DossierReachDialog(props: ReachDialogProps): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  if (props.engagement === null) return null;
  return (
    <EngagementDialog title={t(`${K}.reachDialog.title`)} description={t(`${K}.reachDialog.description`)} onCancel={props.onCancel}>
      <ReachForm {...props} engagement={props.engagement} />
    </EngagementDialog>
  );
}

interface RenewDialogProps {
  readonly engagement: DossierEngagementSummary | null;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onRenew: (engagement: DossierEngagementSummary, shareDays: DossierShareDays) => void;
}

/** Η ημέρα της λήξης **στην ώρα Ελλάδας** — η ίδια σύμβαση με το ημερολόγιο αργιών (`greekPublicHolidayOn`). */
function expiryDayKey(expiresAt: string): string {
  return athensClockAt(new Date(expiresAt)).dateKey;
}

/** «Τρι 16 Φεβ 2027» — με ημέρα εβδομάδας, ώστε ο κάτοχος να ξέρει τι μέρα κλείνει η πρόσβαση χωρίς ημερολόγιο. */
function formatExpiryDay(expiresAt: string): string {
  return formatCalendarDay(expiryDayKey(expiresAt), true);
}

/**
 * Μία γραμμή **μόνο** όταν η νέα λήξη πέφτει σε μη εργάσιμη («λήγει Κυριακή» · «λήγει Καθαρά Δευτέρα»). Ενημέρωση, όχι
 * προειδοποίηση: η πρόσβαση μετρά ημερολογιακές ημέρες και ανοίγει και στις αργίες (Drive · Box · Datasite).
 */
function ExpiryDayNotice({ expiresAt }: { readonly expiresAt: string }) {
  const { t } = useTranslation(['property-market']);
  const reason = nonBusinessDayReason(expiryDayKey(expiresAt));
  if (reason === null) return null;
  const day = reason.kind === 'holiday' ? t(PROFILE_HOLIDAY_KEYS[reason.holiday]) : formatIsoWeekday(reason.weekday);
  return <p className="text-sm text-muted-foreground">{t(`${K}.renewDialog.nonBusinessDay`, { day })}</p>;
}

/** «Τρέχουσα λήξη → νέα» και, αν η νέα είναι νωρίτερα, ρητή προειδοποίηση — η συντόμευση δεν γίνεται ποτέ σιωπηλά. */
function RenewPreview({ currentExpiresAt, nextExpiresAt, shortensBy }: {
  readonly currentExpiresAt: string;
  readonly nextExpiresAt: string;
  readonly shortensBy: number;
}) {
  const { t } = useTranslation(['property-market']);
  return (
    <section className="space-y-2" aria-live="polite">
      <p className="text-sm">
        {t(`${K}.renewDialog.preview`, { current: formatExpiryDay(currentExpiresAt), next: formatExpiryDay(nextExpiresAt) })}
      </p>
      <ExpiryDayNotice expiresAt={nextExpiresAt} />
      {shortensBy > 0 && (
        <Alert variant="destructive" withIcon>
          <AlertDescription>{t(`${K}.renewDialog.shortens`, { count: shortensBy })}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}

function RenewForm({ engagement, busy, onCancel, onRenew }: RenewDialogProps & { readonly engagement: DossierEngagementSummary }) {
  const { t } = useTranslation(['property-market']);
  const [shareDays, setShareDays] = useState<DossierShareDays>(engagement.shareDays);
  /** Η στιγμή που άνοιξε ο διάλογος — σταθερή, ώστε η ημερομηνία που διαβάζει ο κάτοχος να μη «τρέχει» όσο διαλέγει. */
  const [nowMs] = useState(() => Date.now());
  const untilLabel = (days: DossierShareDays) =>
    t(`${K}.renewDialog.option`, { count: days, date: formatExpiryDay(dossierShareExpiresAt(days, nowMs)) });
  const shortensBy = dossierRenewalShortensByDays(engagement.expiresAt, shareDays, nowMs);
  return (
    <>
      <DossierShareDaysField id="dossier-renew-days" value={shareDays} onChange={setShareDays} optionLabel={untilLabel} />
      <RenewPreview currentExpiresAt={engagement.expiresAt} nextExpiresAt={dossierShareExpiresAt(shareDays, nowMs)} shortensBy={shortensBy} />
      <DialogActionFooter
        cancelLabel={t(`${K}.invite.cancel`)}
        confirmLabel={t(shortensBy > 0 ? `${K}.renewDialog.confirmShorten` : `${K}.renewDialog.confirm`)}
        busyLabel={t(`${K}.renewDialog.confirming`)}
        onCancel={onCancel}
        onConfirm={() => onRenew(engagement, shareDays)}
        isSubmitting={busy}
      />
    </>
  );
}

export function DossierRenewDialog(props: RenewDialogProps): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  if (props.engagement === null) return null;
  return (
    <EngagementDialog title={t(`${K}.renewDialog.title`)} description={t(`${K}.renewDialog.description`)} onCancel={props.onCancel}>
      <RenewForm {...props} engagement={props.engagement} />
    </EngagementDialog>
  );
}
