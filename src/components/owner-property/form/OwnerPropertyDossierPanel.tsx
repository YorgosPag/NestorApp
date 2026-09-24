'use client';

/**
 * @fileoverview **ΤΑ ΑΡΧΕΙΑ ΤΟΥ ΦΑΚΕΛΟΥ ΜΕΣΑ ΣΤΗ ΦΟΡΜΑ** — ανέβασμα, ζωντανή λίστα, δήλωση δημοσίευσης (ADR-866 Φ1.3β).
 * @related ADR-866 §2.7.4 · §2.11 · hooks/owner-property/useOwnerPropertyDossierFiles
 * @module components/owner-property/form/OwnerPropertyDossierPanel
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΚΟΥΜΠΙΑ, ΟΧΙ ΕΝΑ ΜΕ ΕΠΙΛΟΓΕΑ ΤΥΠΟΥ ΕΓΓΡΑΦΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η σελίδα του φακέλου ρωτά *«τι έγγραφο είναι;»* γιατί εκεί ο άνθρωπος **οργανώνει** το σπίτι του. Η φόρμα της
 * αγγελίας ρωτά *«τι θα δει ο αγοραστής;»* — και η **Α14** το έκρινε: *«δεν θα επιβάλουμε στον χρήστη να γίνει
 * ειδικός του κλάδου»*. Άρα δύο κουμπιά **είναι** η απάντηση στο «τι είναι αυτό», και η ίδια που θα δώσει μετά η
 * καρτέλα του φακέλου (ίδιες εμβέλειες, `upload-scope.ts`). Zillow/Idealista: «Add photos» · «Add floor plan».
 *
 * 🔑 **Και έτσι κλείνει το Ξ8** (§2.10.9.3, «καρτέλα με έναν τύπο δεν τον προεπιλέγει ⇒ περιττό κλικ») **χωρίς να
 * αναπαραχθεί**: εδώ δεν υπάρχει κλικ να προεπιλεγεί.
 *
 * ⚠️ **Καμία διαγραφή αρχείου από αυτή την οθόνη** — δες το σκεπτικό στο {@link OwnerPropertyDossierItem}.
 */

import React from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { propertyDossierMediaTab, propertyDossierFileTabOf } from '@/components/property-dossier/property-dossier-media';
import { declaredFileIds } from '@/lib/listings/declared-file-ids';
import { withDeclaredFirst } from '@/lib/ordering/declared-order';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';
import {
  PUBLISHABLE_TABS,
  dossierMediaMaterial,
  publishedDossierFiles,
  type PublishableDossierTab,
} from '@/services/property-dossier/dossier-media-publication';
import { PUBLISHED_MEDIA_LIMIT } from '@/services/upload/utils/storage-path-public-shelf';
import {
  useOwnerPropertyDossierFiles,
  type FormDossier,
} from '@/hooks/owner-property/useOwnerPropertyDossierFiles';

import { OwnerPropertyDossierItem } from './OwnerPropertyDossierItem';
import { useDossierFocalPointSlot } from './use-dossier-focal-point-slot';

const NS = 'property-market';
const K = `${NS}:offer.media`;

/**
 * **Ένα κουμπί ανεβάσματος** — γραμμένο **μία** φορά για τις δύο καρτέλες.
 *
 * ⚠️ Δύο αντίγραφα αυτού του μπλοκ (ετικέτα + κρυφό `input` + καθαρισμός τιμής) είναι ακριβώς ο sibling clone που
 * μετρά το CHECK 3.28 — και θα απέκλιναν την ημέρα που το ένα μάθαινε `disabled` και το άλλο όχι.
 */
function DossierUploadButton({
  label,
  accept,
  disabled,
  onFiles,
}: {
  readonly label: string;
  readonly accept: string | undefined;
  readonly disabled: boolean;
  readonly onFiles: (chosen: readonly File[]) => void;
}): React.ReactElement {
  const inputId = React.useId();

  return (
    <>
      <label
        htmlFor={inputId}
        className="inline-block cursor-pointer rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        multiple
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const chosen = Array.from(event.target.files ?? []);
          // ⚠️ Το πεδίο αδειάζει **αμέσως**, ώστε το ίδιο αρχείο να ξαναεπιλέγεται μετά από αποτυχία: ένα
          //    `<input type="file">` δεν πυροδοτεί `change` για ίδια τιμή.
          event.target.value = '';
          onFiles(chosen);
        }}
        className="sr-only"
      />
    </>
  );
}

export function OwnerPropertyDossierPanel({
  dossier,
  isLand,
}: {
  readonly dossier: FormDossier;
  readonly isLand: boolean;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const form = useFormContext<OwnerPropertyFormValues>();
  const { files, upload, uploadFiles } = useOwnerPropertyDossierFiles(dossier);

  const declared = declaredFileIds(form.watch('publishedFileIds'));

  /**
   * 🔑 **Ο ΙΔΙΟΣ επιλογέας με τον γραφέα της βιτρίνας** — άρα ο μετρητής, η σειρά και το «1η στην αγγελία» **δεν
   * μπορούν** να διαφωνήσουν με τον κόσμο. Ό,τι δηλώθηκε αλλά δεν φεύγει (ξένο, μη έτοιμο, μη αποκωδικοποιήσιμο)
   * πέφτει έξω **εδώ**, όπως θα πέσει και εκεί.
   */
  const published = publishedDossierFiles(dossier, files, declared);
  const publishedIds = new Set(published.map((entry) => entry.file.id));
  // 🔑 **Δηλωμένα πρώτα, με τη ΣΕΙΡΑ ΤΗΣ ΔΗΛΩΣΗΣ** — η λίστα στην οθόνη **είναι** η γκαλερί που θα δει ο κόσμος.
  const rows = [...published.map((entry) => entry.file), ...files.filter((file) => !publishedIds.has(file.id))];
  const canPublish = published.length < PUBLISHED_MEDIA_LIMIT;

  /**
   * ⚠️ Διαβάζεται **η τρέχουσα** τιμή (`getValues`) και όχι το `declared` του κλεισίματος — δύο γρήγορα κλικ σε
   * διαφορετικές γραμμές θα έγραφαν το ένα πάνω στο άλλο (N.7.2 #2, το ίδιο ιδίωμα με το `media[]`).
   */
  function declare(next: readonly string[]): void {
    form.setValue('publishedFileIds', [...next], { shouldDirty: true });
  }

  function handleTogglePublished(fileId: string, next: boolean): void {
    const current = declaredFileIds(form.getValues('publishedFileIds'));
    declare(next ? [...current, fileId] : current.filter((id) => id !== fileId));
  }

  const focalPointSlot = useDossierFocalPointSlot();

  function handleMakeFirst(fileId: string): void {
    declare(withDeclaredFirst(declaredFileIds(form.getValues('publishedFileIds')), fileId));
  }

  /**
   * **Ποιες μορφές δέχεται** αυτή η καρτέλα — από τη **ρύθμιση του κελύφους**, ποτέ χειρόγραφη λίστα MIME.
   * Έτσι η φόρμα δέχεται ό,τι και η σελίδα του φακέλου (π.χ. DXF/PDF στην κάτοψη), και μια μελλοντική προσθήκη
   * μορφής γίνεται σε **ένα** σημείο.
   */
  function acceptOf(tab: PublishableDossierTab): string | undefined {
    return propertyDossierMediaTab(tab, dossier.type).acceptedTypes;
  }

  const uploading = upload.state === 'uploading';

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <DossierUploadButton
          label={t(`${K}.dossier.addPhotos`)}
          accept={acceptOf('photos')}
          disabled={uploading}
          onFiles={(chosen) => void uploadFiles(chosen, 'photos')}
        />
        <DossierUploadButton
          label={t(isLand ? `${K}.dossier.addTopographic` : `${K}.dossier.addFloorplan`)}
          accept={acceptOf('floorplan')}
          disabled={uploading}
          onFiles={(chosen) => void uploadFiles(chosen, 'floorplan')}
        />
      </div>

      {upload.state === 'uploading' && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {t(`${K}.dossier.uploading`, { fileName: upload.fileName })}
        </p>
      )}
      {upload.state === 'failed' && (
        <p aria-live="polite" className="text-sm text-foreground">
          {t(`${K}.failed`, { fileName: upload.fileName })}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(`${K}.empty`)}</p>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col p-0">
            {rows.map((file) => {
              // Η καρτέλα ρωτιέται ΜΙΑ φορά ανά γραμμή — τη χρειάζονται και η σήμανση και η εστίαση.
              const tab = propertyDossierFileTabOf(dossier, file, PUBLISHABLE_TABS);
              return (
                <OwnerPropertyDossierItem
                  key={file.id}
                  fileId={file.id}
                  name={file.displayName}
                  tab={tab}
                  isLand={isLand}
                  deliverable={dossierMediaMaterial(dossier, file) !== null}
                  published={publishedIds.has(file.id)}
                  isLead={published[0]?.file.id === file.id}
                  canPublish={canPublish}
                  onTogglePublished={handleTogglePublished}
                  onMakeFirst={handleMakeFirst}
                  focalPointSlot={focalPointSlot(file, tab)}
                />
              );
            })}
          </ul>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {/* 🔴 `published`, ΠΟΤΕ `count` — δεσμευμένο όνομα του i18next (δες το σκεπτικό στο `OwnerPropertyMediaField`). */}
            {t(`${K}.publishedCount`, { published: published.length, max: PUBLISHED_MEDIA_LIMIT })}
          </p>
        </>
      )}
    </>
  );
}
