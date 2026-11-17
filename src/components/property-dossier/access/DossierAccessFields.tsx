'use client';

/**
 * @fileoverview **Τα πεδία της πρόσβασης** — εύρος (καρτέλες + εξαιρέσεις + προεπισκόπηση) και διάρκεια. Ένα σημείο για
 *    την πρόσκληση, την αλλαγή εύρους και την ανανέωση (ADR-916 Φ-Ε1 Σ4).
 * @module components/property-dossier/access/DossierAccessFields
 * @related `services/property-dossier/dossier-share-reach.ts` (`reachCovers` — ο ΙΔΙΟΣ κριτής με την πόρτα ανοίγματος)
 *
 * 🏆 **«Προβολή ως…» (Datasite · Intralinks)**: ο κάτοχος βλέπει **πριν** στείλει τι ακριβώς θα φτάσει — «θα βλέπει N
 *    αρχεία». Η καρτέλα κάθε αρχείου ήρθε από τον server (ο κριτής της πόρτας)· εδώ ρωτιέται **μόνο** το `reachCovers`,
 *    άρα ό,τι υπόσχεται ο διάλογος είναι ό,τι ανοίγει η πόρτα. Το εύρος είναι **καρτέλες, όχι στιγμιότυπο**: ό,τι
 *    προστεθεί αργότερα στην καρτέλα φτάνει — το λέει ρητά η προεπισκόπηση.
 * 🔑 Λέξη καρτέλας από τον ΕΝΑ μεταφραστή `dossierTabWord` (σε οικόπεδο η κάτοψη λέγεται «Τοπογραφικό»).
 */

import React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DOSSIER_SHARE_DAYS, isDossierShareDays, type DossierShareDays } from '@/config/engagement-policy';
import { PROPERTY_DOSSIER_FILE_TABS, type PropertyDossierFileTab } from '@/config/upload-entry-points/entries-property-dossier';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { dossierTabWord, type FloorplanTabKind } from '@/lib/property-dossier/property-dossier-view';
import { reachCovers } from '@/services/property-dossier/dossier-share-reach';
import type { DossierShareReach } from '@/types/engagement';
import type { EngagedDossierFile } from '@/types/my-engagements';

const K = 'property-market:dossier';

/** Η λέξη μιας καρτέλας για **αυτόν** τον φάκελο. */
export function useDossierTabLabel(floorplanKind: FloorplanTabKind): (tab: PropertyDossierFileTab) => string {
  const { t } = useTranslation(['property-market']);
  return (tab) => t(`${K}.tabs.${dossierTabWord(tab, floorplanKind)}`);
}

/** Προσθήκη/αφαίρεση μέλους, με τη **σειρά του καταλόγου** — ποτέ η σειρά των κλικ. */
function toggled<T extends string>(order: readonly T[], selected: readonly T[], value: T, on: boolean): T[] {
  return order.filter((item) => (item === value ? on : selected.includes(item)));
}

interface ReachFieldsProps {
  readonly idPrefix: string;
  readonly floorplanKind: FloorplanTabKind;
  readonly files: readonly EngagedDossierFile[];
  readonly reach: DossierShareReach;
  readonly onChange: (reach: DossierShareReach) => void;
}

function TabChoices({ idPrefix, floorplanKind, reach, onChange }: Omit<ReachFieldsProps, 'files'>) {
  const { t } = useTranslation(['property-market']);
  const tabLabel = useDossierTabLabel(floorplanKind);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t(`${K}.access.reach.tabsLabel`)}</legend>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {PROPERTY_DOSSIER_FILE_TABS.map((tab) => (
          <li key={tab} className="flex items-center gap-2">
            <Checkbox
              id={`${idPrefix}-tab-${tab}`}
              checked={reach.tabs.includes(tab)}
              onCheckedChange={(on) => onChange({ ...reach, tabs: toggled(PROPERTY_DOSSIER_FILE_TABS, reach.tabs, tab, on === true) })}
            />
            <Label htmlFor={`${idPrefix}-tab-${tab}`}>{tabLabel(tab)}</Label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function FileChoices({ idPrefix, files, reach, onChange }: Omit<ReachFieldsProps, 'floorplanKind'>) {
  const { t } = useTranslation(['property-market']);
  const inTabs = files.filter((file) => reach.tabs.includes(file.tab));
  const ids = files.map((file) => file.fileId);
  const setIncluded = (fileId: string, included: boolean) =>
    onChange({ ...reach, excludedFileIds: toggled(ids, reach.excludedFileIds, fileId, !included) });
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t(`${K}.access.reach.filesLabel`)}</legend>
      {inTabs.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{t(`${K}.access.reach.noFiles`)}</p>
      ) : (
        <>
          <p className="m-0 text-xs text-muted-foreground">{t(`${K}.access.reach.filesHint`)}</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {inTabs.map((file) => (
              <li key={file.fileId} className="flex items-center gap-2">
                <Checkbox
                  id={`${idPrefix}-file-${file.fileId}`}
                  checked={reachCovers(reach, file.fileId, file.tab)}
                  onCheckedChange={(on) => setIncluded(file.fileId, on === true)}
                />
                <Label htmlFor={`${idPrefix}-file-${file.fileId}`} className="min-w-0 truncate font-normal">{file.fileName}</Label>
              </li>
            ))}
          </ul>
        </>
      )}
    </fieldset>
  );
}

/** Πόσα αρχεία **φτάνουν** με αυτό το εύρος — ο ΙΔΙΟΣ κριτής με την πόρτα. */
export function reachedCount(files: readonly EngagedDossierFile[], reach: DossierShareReach): number {
  return files.filter((file) => reachCovers(reach, file.fileId, file.tab)).length;
}

/** Καρτέλες + εξαιρέσεις + η προεπισκόπηση «θα βλέπει N αρχεία». */
export function DossierReachFields(props: ReachFieldsProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    <section className="space-y-3">
      <TabChoices idPrefix={props.idPrefix} floorplanKind={props.floorplanKind} reach={props.reach} onChange={props.onChange} />
      <FileChoices idPrefix={props.idPrefix} files={props.files} reach={props.reach} onChange={props.onChange} />
      <p role="status" className="m-0 text-sm font-medium text-foreground">
        {props.reach.tabs.length === 0
          ? t(`${K}.access.reach.noTab`)
          : t(`${K}.access.reach.preview`, { count: reachedCount(props.files, props.reach) })}
      </p>
    </section>
  );
}

/** Η διάρκεια — **μόνο** από το κλειστό μενού πολιτικής (`DOSSIER_SHARE_DAYS`), ποτέ ελεύθερος αριθμός. */
export function DossierShareDaysField({ id, value, onChange }: {
  readonly id: string;
  readonly value: DossierShareDays;
  readonly onChange: (days: DossierShareDays) => void;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    <section className="space-y-2">
      <Label htmlFor={id}>{t(`${K}.access.invite.daysLabel`)}</Label>
      <Select value={String(value)} onValueChange={(raw) => { const days = Number(raw); if (isDossierShareDays(days)) onChange(days); }}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>
          {DOSSIER_SHARE_DAYS.map((days) => (
            <SelectItem key={days} value={String(days)}>{t(`${K}.access.invite.days`, { count: days })}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  );
}
