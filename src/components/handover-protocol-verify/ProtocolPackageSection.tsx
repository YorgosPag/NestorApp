'use client';

/**
 * @fileoverview **Ο έλεγχος πακέτου στην οθόνη** — τα αρχεία που πήρε ο τρίτος, γραμμή προς γραμμή απέναντι στον
 *               σφραγισμένο πίνακα (ADR-916 Φ-Γ2 Σ6 · BagIt RFC 8493).
 * @module components/handover-protocol-verify/ProtocolPackageSection
 *
 * 🔑 Εμφανίζεται **μόνο** κάτω από γνήσιο Πρωτόκολλο: ο πίνακας αξίζει όσο αξίζει η σφραγίδα που τον καλύπτει.
 * 🔑 Κάθε κατάσταση γραμμής είναι **λέξη** (CHECK 3.41)· ρητές κλήσεις `t('…')` (ADR-744).
 */

import React from 'react';

import { HANDOVER_PROTOCOL_VERIFY_MAX_PACKAGE_FILE_BYTES } from '@/config/handover-protocol-verification-policy';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  HandoverPackageCheck,
  HandoverPackageExtra,
  HandoverPackageRowStatus,
} from '@/lib/property-handover/handover-protocol-package-check';
import type { HandoverProtocolManifest } from '@/lib/property-handover/handover-protocol-manifest-parse';
import { formatFileSize } from '@/utils/file-validation';

import { ProtocolFilePicker } from './ProtocolFilePicker';
import { useHandoverPackageCheck, type HandoverPackageCheckState } from './use-handover-protocol-verification';

function RowStatus({ status }: { readonly status: HandoverPackageRowStatus }) {
  const { t } = useTranslation('legal');
  switch (status) {
    case 'match':
      return <strong>{t('handoverVerify.package.status.match')}</strong>;
    case 'differs':
      return <strong>{t('handoverVerify.package.status.differs')}</strong>;
    case 'unchecked':
      return <strong>{t('handoverVerify.package.status.unchecked')}</strong>;
    case 'not-provided':
      return <strong>{t('handoverVerify.package.status.notProvided')}</strong>;
  }
}

function ExtraReason({ reason }: { readonly reason: HandoverPackageExtra['reason'] }) {
  const { t } = useTranslation('legal');
  return reason === 'unchecked'
    ? <>{t('handoverVerify.package.extra.unchecked')}</>
    : <>{t('handoverVerify.package.extra.notInProtocol')}</>;
}

function PackageTable({ check }: { readonly check: HandoverPackageCheck }) {
  const { t, i18n } = useTranslation('legal');
  return (
    <>
      <p className="m-0 text-sm font-medium text-foreground">
        {check.complete ? t('handoverVerify.package.complete') : t('handoverVerify.package.incomplete')}
      </p>
      <section className="max-w-full overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t('handoverVerify.package.caption')}</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">{t('handoverVerify.package.columnFile')}</th>
              <th scope="col" className="py-1 pr-3 font-medium">{t('handoverVerify.package.columnSize')}</th>
              <th scope="col" className="py-1 font-medium">{t('handoverVerify.package.columnStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {check.rows.map((row, index) => (
              <tr key={`${row.file.sourceFileId}-${row.file.copyFileId}`} className="border-b border-border align-top">
                <td className="break-all py-1 pr-3">
                  {row.file.name ?? t('handoverVerify.package.unnamed', { index: index + 1 })}
                  {row.providedName !== null && row.providedName !== row.file.name && (
                    <small className="block text-muted-foreground">{t('handoverVerify.package.providedAs', { name: row.providedName })}</small>
                  )}
                </td>
                <td className="whitespace-nowrap py-1 pr-3">{formatFileSize(row.file.size, i18n.language)}</td>
                <td className="py-1"><RowStatus status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {check.extras.length > 0 && (
        <section className="flex flex-col gap-1 text-sm">
          <h4 className="m-0 font-medium text-foreground">{t('handoverVerify.package.extrasTitle')}</h4>
          <ul className="m-0 list-disc pl-5">
            {check.extras.map((extra, index) => (
              <li key={`${extra.name}-${index}`} className="break-all">{extra.name} — <ExtraReason reason={extra.reason} /></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Η όψη μόνο — η γκαλερί τη ζωγραφίζει με κατάσταση από τον **πραγματικό** κριτή. */
export function ProtocolPackageView({ state }: { readonly state: HandoverPackageCheckState }) {
  const { t, i18n } = useTranslation('legal');
  if (state.phase === 'idle') return null;
  if (state.phase === 'hashing') return <p className="m-0 text-sm text-foreground" role="status">{t('handoverVerify.package.hashing', { done: state.done, total: state.total })}</p>;
  const limit = formatFileSize(HANDOVER_PROTOCOL_VERIFY_MAX_PACKAGE_FILE_BYTES, i18n.language);
  const unchecked = state.check.rows.some((row) => row.status === 'unchecked') || state.check.extras.some((extra) => extra.reason === 'unchecked');
  return (
    <>
      <PackageTable check={state.check} />
      {unchecked && <p className="m-0 text-sm text-muted-foreground">{t('handoverVerify.package.largeHint', { limit })}</p>}
    </>
  );
}

/** **Ο έλεγχος πακέτου** — επιλογέας + αποτέλεσμα, για ένα γνήσιο manifest. */
export function ProtocolPackageSection({ manifest }: { readonly manifest: HandoverProtocolManifest }) {
  const { t } = useTranslation('legal');
  const { state, check } = useHandoverPackageCheck(manifest);
  return (
    <ProtocolFilePicker
      title={t('handoverVerify.pick.packageTitle')}
      hint={t('handoverVerify.pick.packageHint')}
      action={t('handoverVerify.pick.chooseMany')}
      level="h3"
      multiple
      onFiles={(files) => void check(files)}
    >
      <ProtocolPackageView state={state} />
    </ProtocolFilePicker>
  );
}
