'use client';

/**
 * @fileoverview **Η ΔΗΛΩΣΗ ΚΑΤΟΨΗΣ ΟΡΟΦΟΥ ΣΤΟΝ ΧΩΡΟ** — ποιος υπέγραψε, πότε, για ποια εικόνα· υπογραφή και άρση από
 * την **ίδια** πόρτα (ADR-907 §11.10).
 * @related hooks/listings/useFloorPlateDeclaration (η πόρτα) · ./FloorPlateSigningForm (η υπογραφή) ·
 *   components/listings/PublishedMediaAgreement (το ίδιο ιδίωμα: ο διακομιστής κρίνει, η οθόνη διαλέγει λέξεις)
 * @module components/listings/FloorPlateDeclaration
 *
 * Κάθεται **κάτω από τις κατόψεις του ορόφου** — εκεί όπου ο άνθρωπος ανεβάζει την εικόνα, τη σημαίνει δημόσια και
 * σχεδιάζει τα περιγράμματα. Η δήλωση είναι το τελευταίο βήμα της ίδιας δουλειάς, όχι άλλη οθόνη.
 *
 * ⛔ **ΚΑΜΙΑ ΚΡΙΣΗ ΕΔΩ.** «Υπάρχει δήλωση;», «μπορώ να υπογράψω;», «γιατί αρνήθηκε;» έρχονται από τον διακομιστή. Το
 * μόνο που ξέρει αυτό το αρχείο για τα αρχεία είναι **ποια είναι εικόνες του ορόφου** — με τον ΕΝΑ κριτή
 * καταλληλότητας (`isDeliverableListingImage`), τον ίδιο που ρωτά η πόρτα.
 *
 * ⚠️ **Σιωπά όταν δεν έχει να πει κάτι**: όσο ο διακομιστής δεν έχει απαντήσει, και όταν η ανάγνωση απέτυχε.
 * ⚠️ **ΔΕΝ φτάνει ΠΟΤΕ στον επισκέπτη** — εργαλείο κηδεμονίας, lazy namespace.
 */

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { useEntityFileRecords } from '@/hooks/files/useEntityFileRecords';
import {
  useFloorPlateDeclaration,
  type FloorPlateDeclarationDoor,
} from '@/hooks/listings/useFloorPlateDeclaration';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateTime } from '@/lib/intl-formatting';
import type { FloorPlateDeclaration as SignedDeclaration } from '@/lib/listings/floor-plate/floor-plate-declaration';
import { FLOOR_PLATE_REFUSAL_MESSAGE } from '@/lib/listings/floor-plate/floor-plate-refusal';
import { isDeliverableListingImage } from '@/lib/listings/listing-file-deliverability';
import type { FileRecord } from '@/types/file-record';

import { FloorPlateSigningForm } from './FloorPlateSigningForm';

export interface FloorPlateDeclarationProps {
  readonly floorId: string;
  /** Ο μισθωτής του ορόφου (του κτιρίου του) — όχι απαραίτητα του χρήστη (super_admin). */
  readonly companyId: string | null | undefined;
}

/** Οι εικόνες του ορόφου που **μπορούν** να φύγουν ως εικόνα· `null` όσο τα αρχεία δεν έχουν διαβαστεί. */
function floorImagesOf(files: readonly FileRecord[] | null): readonly FileRecord[] | null {
  return files === null ? null : files.filter((file) => isDeliverableListingImage(file, ENTITY_TYPES.FLOOR));
}

interface StandingProps {
  readonly declaration: SignedDeclaration;
  readonly images: readonly FileRecord[] | null;
  readonly mayDeclare: boolean;
  readonly busy: boolean;
  readonly onWithdraw: () => void;
}

/** **Ποιος, πότε, ποια εικόνα** — λίστα όρων, όχι πρόταση: η στιγμή μένει `<time>` που διαβάζει μηχανή. */
function SignatureFacts({ declaration, image }: { readonly declaration: SignedDeclaration; readonly image: FileRecord | null }): React.JSX.Element {
  const { t } = useTranslation(['building-tabs']);
  const fileName = useFileDisplayName();
  const signer = useUserDisplayNames([declaration.declaredBy]).get(declaration.declaredBy);

  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5" data-floor-plate-signature="">
      <dt className="text-muted-foreground">{t('tabs.floors.floorPlate.signer')}</dt>
      <dd className="m-0">{signer ?? t('tabs.floors.floorPlate.signerUnknown')}</dd>
      <dt className="text-muted-foreground">{t('tabs.floors.floorPlate.signedAt')}</dt>
      <dd className="m-0"><time dateTime={declaration.declaredAt}>{formatDateTime(declaration.declaredAt)}</time></dd>
      {image !== null && (
        <>
          <dt className="text-muted-foreground">{t('tabs.floors.floorPlate.image')}</dt>
          <dd className="m-0 break-words">{fileName(image)}</dd>
        </>
      )}
    </dl>
  );
}

/** Η δήλωση που ισχύει — και η άρση, πίσω από επιβεβαίωση: αποσύρει την κάτοψη από **κάθε** αγγελία του ορόφου. */
function StandingDeclaration({ declaration, images, mayDeclare, busy, onWithdraw }: StandingProps): React.JSX.Element {
  const { t } = useTranslation(['building-tabs']);
  const [confirming, setConfirming] = React.useState(false);
  const image = images?.find((candidate) => candidate.id === declaration.fileId) ?? null;

  return (
    <>
      <p className="m-0">{t('tabs.floors.floorPlate.declared')}</p>
      <SignatureFacts declaration={declaration} image={image} />
      {/* Η δήλωση **μένει** όταν η εικόνα φύγει (§11.7)· ο άνθρωπος οφείλει να ξέρει ότι η κάτοψη δεν φαίνεται πια. */}
      {images !== null && image === null && (
        <p role="alert" className="m-0 text-destructive">{t('tabs.floors.floorPlate.imageGone')}</p>
      )}
      {mayDeclare && (
        <Button type="button" variant="outline" size="sm" className="self-start" disabled={busy} onClick={() => setConfirming(true)}>
          {t(busy ? 'tabs.floors.floorPlate.withdrawBusy' : 'tabs.floors.floorPlate.withdraw')}
        </Button>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('tabs.floors.floorPlate.withdrawConfirmTitle')}
        description={t('tabs.floors.floorPlate.withdrawConfirmBody')}
        confirmText={t('tabs.floors.floorPlate.withdraw')}
        variant="destructive"
        onConfirm={onWithdraw}
      />
    </>
  );
}

/** Η έκβαση της **τελευταίας** πράξης: άρνηση με όνομα (και το περίγραμμα που φταίει), αποτυχία, ή πόσες αγγελίες άλλαξαν. */
function DoorOutcome({ failure, refreshedListings }: Pick<FloorPlateDeclarationDoor, 'failure' | 'refreshedListings'>): React.JSX.Element | null {
  const { t } = useTranslation(['building-tabs']);

  if (failure?.kind === 'failed') {
    return <p role="alert" className="m-0 text-destructive">{t('tabs.floors.floorPlate.failed')}</p>;
  }
  if (failure?.kind === 'refused') {
    const { why, overlayId } = failure.notice;
    return (
      <p role="alert" className="m-0 text-destructive" data-floor-plate-refusal={why}>
        <strong>{t('tabs.floors.floorPlate.refusedLead')}</strong>{' '}
        {t(`tabs.floors.floorPlate.refusal.${FLOOR_PLATE_REFUSAL_MESSAGE[why]}`)}
        {overlayId !== null && <>{' '}<small>{t('tabs.floors.floorPlate.outlineRef', { id: overlayId })}</small></>}
      </p>
    );
  }
  if (refreshedListings === null) return null;

  return (
    <p role="status" className="m-0 text-muted-foreground">
      {refreshedListings === 0
        ? t('tabs.floors.floorPlate.listingsNone')
        : t('tabs.floors.floorPlate.listingsRefreshed', { count: refreshedListings })}
    </p>
  );
}

export function FloorPlateDeclaration({ floorId, companyId }: FloorPlateDeclarationProps): React.JSX.Element | null {
  const { t } = useTranslation(['building-tabs']);
  const headingId = React.useId();
  const door = useFloorPlateDeclaration(floorId);
  const files = useEntityFileRecords({
    entityType: ENTITY_TYPES.FLOOR,
    entityId: floorId,
    category: FILE_CATEGORIES.FLOORPLANS,
    companyId,
    enabled: door.status !== null,
    refreshOnFileChange: true,
  });
  const images = React.useMemo(() => floorImagesOf(files.data), [files.data]);

  if (door.status === null) return null;
  const { declaration, mayDeclare } = door.status;

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={door.busy}
      data-floor-plate-declaration=""
      className="mt-2 flex flex-col gap-2 border-t border-border/30 pt-2 text-xs"
    >
      <h4 id={headingId} className="m-0 text-xs font-medium text-muted-foreground">{t('tabs.floors.floorPlate.title')}</h4>
      {declaration !== null && (
        <StandingDeclaration declaration={declaration} images={images} mayDeclare={mayDeclare} busy={door.busy} onWithdraw={door.withdraw} />
      )}
      {declaration === null && mayDeclare && (
        <FloorPlateSigningForm images={images} busy={door.busy} onDeclare={door.declare} />
      )}
      {declaration === null && !mayDeclare && <p className="m-0">{t('tabs.floors.floorPlate.notDeclared')}</p>}
      <DoorOutcome failure={door.failure} refreshedListings={door.refreshedListings} />
    </section>
  );
}
