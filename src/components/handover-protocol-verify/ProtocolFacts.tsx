'use client';

/**
 * @fileoverview **Τα στοιχεία ενός Πρωτοκόλλου** — από το ίδιο το αρχείο (τοπικά) και από το μητρώο (ADR-916 Φ-Γ2 Σ6).
 * @module components/handover-protocol-verify/ProtocolFacts
 *
 * 🔒 Τα ονόματα (εκδότης · ακίνητο · παραλήπτης) έρχονται **μόνο** από το manifest του αρχείου που κρατά ήδη ο αναγνώστης
 *    — ποτέ από το μητρώο, που δεν τα επιστρέφει.
 * 🔑 Ρητές κλήσεις `t('…')`: ο σαρωτής του route slice (ADR-744) δεν βλέπει αναζητήσεις σε χάρτη.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateTime } from '@/lib/intl-formatting';
import type { HandoverProtocolManifest } from '@/lib/property-handover/handover-protocol-manifest-parse';
import type { HandoverProtocolRegisteredAnswer } from '@/lib/property-handover/handover-protocol-verification';
import { handoverProtocolLegalTextHref } from '@/lib/property-handover/handover-protocol-terms';
import { Link } from '@/lib/workspace/navigation';
import { formatFileSize } from '@/utils/file-validation';

const DL_CLASS = 'm-0 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm';
const DT_CLASS = 'text-muted-foreground';
const DD_CLASS = 'm-0 min-w-0 break-words text-foreground';

export function ProtocolFact({ term, children }: { readonly term: string; readonly children: React.ReactNode }) {
  return (
    <>
      <dt className={DT_CLASS}>{term}</dt>
      <dd className={DD_CLASS}>{children}</dd>
    </>
  );
}

/** Αρχεία + μέγεθος · αποτύπωμα · κείμενο όρων — κοινά στις δύο πηγές. */
function DeliveryFacts({ rows, bytes, digest, legalTextVersion }: {
  readonly rows: number;
  readonly bytes: number;
  readonly digest: string;
  readonly legalTextVersion: number;
}) {
  const { t, i18n } = useTranslation('legal');
  return (
    <>
      <ProtocolFact term={t('handoverVerify.facts.files')}>
        {t('handoverVerify.facts.filesValue', { count: rows, size: formatFileSize(bytes, i18n.language) })}
      </ProtocolFact>
      <ProtocolFact term={t('handoverVerify.facts.digest')}>
        <code className="break-all">{digest}</code>
      </ProtocolFact>
      <ProtocolFact term={t('handoverVerify.facts.legalText')}>
        <Link href={handoverProtocolLegalTextHref(legalTextVersion)} className="underline underline-offset-4">
          {t('handoverVerify.facts.legalTextValue', { version: legalTextVersion })}
        </Link>
      </ProtocolFact>
    </>
  );
}

/** **Ό,τι λέει το αρχείο** — διαβάστηκε στη συσκευή του αναγνώστη. */
export function ProtocolManifestFacts({ manifest }: { readonly manifest: HandoverProtocolManifest }) {
  const { t } = useTranslation('legal');
  const { protocol, delivery } = manifest;
  return (
    <dl className={DL_CLASS}>
      <ProtocolFact term={t('handoverVerify.facts.revision')}>{protocol.revision}</ProtocolFact>
      <ProtocolFact term={t('handoverVerify.facts.issuedAt')}>{formatDateTime(protocol.issuedAt)}</ProtocolFact>
      {manifest.issuerName !== null && <ProtocolFact term={t('handoverVerify.facts.issuer')}>{manifest.issuerName}</ProtocolFact>}
      {manifest.propertyLabel !== null && <ProtocolFact term={t('handoverVerify.facts.property')}>{manifest.propertyLabel}</ProtocolFact>}
      {manifest.recipientName !== null && <ProtocolFact term={t('handoverVerify.facts.recipient')}>{manifest.recipientName}</ProtocolFact>}
      <DeliveryFacts rows={delivery.files.length} bytes={delivery.totalBytes} digest={delivery.digest} legalTextVersion={manifest.legalText.version} />
      {/* Φ-Δ.7γ — τίμια: παραδόθηκαν, αλλά δεν υπάρχει τιμή να συγκριθεί· ποτέ σιωπηλά εκτός μέτρησης. */}
      {delivery.closed.length > 0 && (
        <ProtocolFact term={t('handoverVerify.facts.closed')}>{t('handoverVerify.facts.closedValue', { count: delivery.closed.length })}</ProtocolFact>
      )}
      <ProtocolFact term={t('handoverVerify.facts.code')}>
        <code className="break-all">{protocol.id}</code>
      </ProtocolFact>
    </dl>
  );
}

/** **Ό,τι λέει το μητρώο** — μόνο όσα τυπώνει ήδη το χαρτί, κανένα όνομα. */
export function ProtocolRegistryFacts({ protocolId, registry, children }: {
  readonly protocolId: string;
  readonly registry: HandoverProtocolRegisteredAnswer;
  readonly children?: React.ReactNode;
}) {
  const { t } = useTranslation('legal');
  return (
    <dl className={DL_CLASS}>
      <ProtocolFact term={t('handoverVerify.facts.revision')}>{registry.revision}</ProtocolFact>
      <ProtocolFact term={t('handoverVerify.facts.issuedAt')}>{formatDateTime(registry.issuedAt)}</ProtocolFact>
      {children}
      <DeliveryFacts rows={registry.rows} bytes={registry.bytes} digest={registry.digest} legalTextVersion={registry.legalTextVersion} />
      <ProtocolFact term={t('handoverVerify.facts.code')}>
        <code className="break-all">{protocolId}</code>
      </ProtocolFact>
    </dl>
  );
}

