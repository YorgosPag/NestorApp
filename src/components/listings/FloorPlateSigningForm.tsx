'use client';

/**
 * @fileoverview **Η ΥΠΟΓΡΑΦΗ** — «διαχειρίζομαι όλες τις μονάδες αυτού του ορόφου» (ADR-907 §11.10).
 * @related ./FloorPlateDeclaration (ο γονέας) · hooks/listings/useFloorPlateDeclaration (η πόρτα)
 * @module components/listings/FloorPlateSigningForm
 *
 * Τρία πράγματα ζητά από τον άνθρωπο, με αυτή τη σειρά: **ποια εικόνα**, **τη δήλωσή του**, **το πάτημα**. Το κουμπί
 * μένει κλειστό ώσπου να υπάρχουν και τα δύο πρώτα — η υπογραφή δεν είναι ποτέ παρενέργεια ενός κλικ.
 *
 * ⛔ **ΚΑΜΙΑ ΚΡΙΣΗ ΕΔΩ.** Η λίστα δείχνει κάθε εικόνα του ορόφου, και όσες **δεν** είναι δημόσιες: το αν ο όροφος βγαίνει
 * το αποφασίζει ο διακομιστής και το λέει με όνομα. Η σήμανση «όχι δημόσια» είναι **υπόδειξη**, όχι φίλτρο.
 */

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FILE_CLASSIFICATIONS } from '@/config/domain-constants';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FileRecord } from '@/types/file-record';

export interface FloorPlateSigningFormProps {
  /** Οι εικόνες του ορόφου· `null` όσο δεν έχουν διαβαστεί — η φόρμα **σιωπά**. */
  readonly images: readonly FileRecord[] | null;
  readonly busy: boolean;
  readonly onDeclare: (fileId: string) => void;
}

/**
 * Ποια εικόνα υπογράφεται: ό,τι διάλεξε ο άνθρωπος **αν υπάρχει ακόμη**· αλλιώς η μοναδική· αλλιώς καμία.
 * Με δύο εικόνες δεν διαλέγουμε εμείς — η υπογραφή ονομάζει εικόνα.
 */
export function chosenFloorPlateImageId(images: readonly FileRecord[], picked: string | null): string | null {
  if (picked !== null && images.some((image) => image.id === picked)) return picked;
  return images.length === 1 ? images[0].id : null;
}

export function FloorPlateSigningForm({ images, busy, onDeclare }: FloorPlateSigningFormProps): React.JSX.Element | null {
  const { t } = useTranslation(['building-tabs']);
  const fileName = useFileDisplayName();
  const imageId = React.useId();
  const statementId = React.useId();
  const noteId = React.useId();
  const [picked, setPicked] = React.useState<string | null>(null);
  const [agreed, setAgreed] = React.useState(false);

  if (images === null) return null;
  if (images.length === 0) {
    return <p className="m-0 text-muted-foreground" data-floor-plate-no-image="">{t('tabs.floors.floorPlate.noImage')}</p>;
  }

  const chosen = chosenFloorPlateImageId(images, picked);
  const optionLabel = (image: FileRecord): string =>
    image.classification === FILE_CLASSIFICATIONS.PUBLIC
      ? fileName(image)
      : `${fileName(image)} — ${t('tabs.floors.floorPlate.notPublicSuffix')}`;

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" disabled={busy}>
      <legend className="sr-only">{t('tabs.floors.floorPlate.title')}</legend>

      <label htmlFor={imageId} className="font-medium">{t('tabs.floors.floorPlate.pickImage')}</label>
      <Select value={chosen ?? ''} onValueChange={setPicked} disabled={busy}>
        <SelectTrigger id={imageId} className="min-w-56 max-w-full self-start">
          <SelectValue placeholder={t('tabs.floors.floorPlate.pickImagePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {images.map((image) => (
            <SelectItem key={image.id} value={image.id}>{optionLabel(image)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label htmlFor={statementId} className="flex cursor-pointer items-start gap-2 font-medium">
        <Checkbox
          id={statementId}
          aria-describedby={noteId}
          checked={agreed}
          onCheckedChange={(value) => setAgreed(value === true)}
          disabled={busy}
        />
        <span>{t('tabs.floors.floorPlate.statement')}</span>
      </label>
      <p id={noteId} className="m-0 text-muted-foreground">{t('tabs.floors.floorPlate.statementNote')}</p>

      <Button
        type="button"
        size="sm"
        className="self-start"
        disabled={busy || !agreed || chosen === null}
        onClick={() => { if (chosen !== null && agreed) onDeclare(chosen); }}
      >
        {t(busy ? 'tabs.floors.floorPlate.declareBusy' : 'tabs.floors.floorPlate.declare')}
      </Button>
    </fieldset>
  );
}
