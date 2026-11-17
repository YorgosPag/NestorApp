'use client';

/**
 * ADR-942 Φ1 — **«Έγγραφα που ζήτησε ο μηχανικός»** στο πάνελ της ανάθεσης του γραφείου: τι ζητήθηκε, τι υπάρχει ήδη,
 * και ανέβασμα **κατευθείαν στον φάκελο του ακινήτου** (θεματοφυλακή του κατόχου, ADR-942 Ε2 — κανένα αντίγραφο).
 *
 * 🔑 **Ο κανονικός αγωγός, όχι δεύτερος**: `resolveUploadScope` + `uploadEntityFile` με το είδος του καταλόγου ⇒ το
 *    αρχείο μπαίνει στη **σωστή** θέση του φακέλου, και το «υπάρχει» το ξαναβρίσκει ο server με τον ίδιο σκοπό.
 * 🔑 Μετά το ανέβασμα ο server **κρίνει μόνος του** το αρχείο και ειδοποιεί τον μηχανικό (ιδεμποτικά)· η λίστα
 *    ξαναδιαβάζεται — το «εκκρεμεί» σβήνει γιατί **παράγεται**, όχι γιατί το σβήσαμε εδώ.
 * 🔑 ADR-942 Φ2 — ό,τι ανεβαίνει **ως απάντηση** δίνεται στον μηχανικό· ό,τι **υπήρχε** δίνεται μόνο με ρητό «Δώσε από τον
 *    φάκελο». Η δήλωση σκοπού (ΓΚΠΔ άρθρο 13) φαίνεται **πριν** από κάθε πράξη, στην κεφαλίδα και στην επιβεβαίωση.
 *
 * @module components/document-registry/RegistryIssuanceDocumentRequests
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { FileUploadButton } from '@/components/shared/files/FileUploadButton';
import { resolveUploadScope } from '@/lib/files/upload-scope';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { findCatalogEntryForFile } from '@/config/upload-entry-points/queries';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  announceIssuanceDocumentProvided,
  fetchIssuanceDocumentRequests,
  type IssuanceDocumentRequestsLoad,
  type IssuanceUploadTarget,
} from '@/services/document-registry/document-registry.client';
import { validateUploadAuth } from '@/services/filesystem/file-mutation-gateway';
import { uploadEntityFile } from '@/services/filesystem/upload-entity-file';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { IssuanceRequestItemView } from '@/types/issuance-document-request';
import { IssuanceDocumentRequestList } from './IssuanceDocumentRequestList';
import { ISSUANCE_REQUEST_KEYS } from './issuance-request-labels';
import { GiveExistingAction, GivenFilesOffice, useProvisionActions, useRetentionNotice } from './RegistryIssuanceProvisions';
import type { RegistryIssuanceView } from './registry-issuance';

interface UploadContext {
  readonly view: RegistryIssuanceView;
  readonly target: IssuanceUploadTarget;
  readonly onUploaded: () => void;
}

/** Ανέβασμα **ενός** είδους στον φάκελο του κατόχου — με το είδος του καταλόγου (σωστή θέση, σωστός σκοπός). */
function useItemUpload({ view, target, onUploaded }: UploadContext) {
  const { t } = useTranslation(['document-registry']);
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId ?? null;
  const { success, error } = useNotifications();
  const [uploading, setUploading] = useState<string | null>(null);
  const upload = useCallback(async (item: IssuanceRequestItemView, file: File) => {
    const entry = findCatalogEntryForFile(ENTITY_TYPES.PROPERTY, { entryPointId: item.itemId });
    if (user === null || companyId === null || entry === undefined) return error(t(ISSUANCE_REQUEST_KEYS.uploadFailed));
    setUploading(item.itemId);
    try {
      await validateUploadAuth(companyId);
      const scope = resolveUploadScope(entry, { domain: entry.domain, category: entry.category, purposeAuthority: 'entry' });
      const uploaded = await uploadEntityFile(
        { custody: { companyId }, entityType: target.entityType, entityId: target.entityId, ...scope, createdBy: user.uid },
        file,
      );
      success(t(ISSUANCE_REQUEST_KEYS.uploaded));
      // Δίχτυ ασφαλείας: αποτυχία εδώ δεν αναιρεί το ανέβασμα — ο μηχανικός βλέπει ήδη «Υπάρχει στον φάκελο».
      await announceIssuanceDocumentProvided({ propertyId: view.propertyId, documentKind: view.kind, fileId: uploaded.fileId });
      onUploaded();
    } catch {
      error(t(ISSUANCE_REQUEST_KEYS.uploadFailed));
    } finally {
      setUploading(null);
    }
  }, [user, companyId, target, view.propertyId, view.kind, onUploaded, success, error, t]);
  return { uploading, upload };
}

function useRequestsLoad(view: RegistryIssuanceView) {
  const [load, setLoad] = useState<IssuanceDocumentRequestsLoad | null>(null);
  const reload = useCallback(() => {
    void fetchIssuanceDocumentRequests(view.propertyId, view.kind).then(setLoad);
  }, [view.propertyId, view.kind]);
  useEffect(reload, [reload]);
  return { load, reload };
}

function ReadyRequests({ view, panel, target, canAct, onUploaded }: UploadContext & {
  readonly panel: Extract<IssuanceDocumentRequestsLoad, { kind: 'ready' }>['panel'];
  readonly canAct: boolean;
}) {
  const { t } = useTranslation(['document-registry']);
  const colors = useSemanticColors();
  const { uploading, upload } = useItemUpload({ view, target, onUploaded });
  const actions = useProvisionActions(view, onUploaded);
  const notice = useRetentionNotice(panel);
  const asked = panel.log.length > 0;
  return (
    <section aria-labelledby="registry-issuance-requests-title" className="flex flex-col gap-2 border-t border-border pt-2">
      <header className="space-y-1">
        <h3 id="registry-issuance-requests-title" className="m-0 text-sm font-medium">{t(ISSUANCE_REQUEST_KEYS.title)}</h3>
        <p className={cn('m-0 text-xs', colors.text.muted)}>{t(asked ? ISSUANCE_REQUEST_KEYS.leadOffice : ISSUANCE_REQUEST_KEYS.noneRequested)}</p>
        <p className={cn('m-0 text-xs', colors.text.muted)}>{t(ISSUANCE_REQUEST_KEYS.sharingLead)}</p>
        {notice !== null && <p className={cn('m-0 text-xs', colors.text.muted)}>{notice}</p>}
      </header>
      <IssuanceDocumentRequestList
        panel={panel}
        log={panel.log}
        action={(item) => (!canAct ? null : (
          <span className="flex flex-wrap items-center gap-2">
            {item.providedAt === null && (
              <FileUploadButton
                onFileSelect={(file) => void upload(item, file)}
                accept="application/pdf,image/*"
                buttonText={t(uploading === item.itemId ? ISSUANCE_REQUEST_KEYS.uploading : ISSUANCE_REQUEST_KEYS.upload)}
                loading={uploading === item.itemId}
                disabled={uploading !== null}
              />
            )}
            <GiveExistingAction item={item} notice={notice} actions={actions} />
          </span>
        ))}
        files={(item) => <GivenFilesOffice item={item} actions={actions} canAct={canAct} />}
      />
    </section>
  );
}

export function RegistryIssuanceDocumentRequests({ view, canAct }: { readonly view: RegistryIssuanceView; readonly canAct: boolean }): React.ReactElement | null {
  const { t } = useTranslation(['document-registry']);
  const colors = useSemanticColors();
  const { load, reload } = useRequestsLoad(view);
  if (load === null || load.kind === 'unavailable') return null;
  if (load.kind === 'failed') return <p className={cn('m-0 text-xs', colors.text.muted)}>{t(ISSUANCE_REQUEST_KEYS.unknown)}</p>;
  return <ReadyRequests view={view} panel={load.panel} target={load.upload} canAct={canAct} onUploaded={reload} />;
}
