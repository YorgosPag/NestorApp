'use client';

/**
 * @fileoverview **Διάλεξε ή σύρε το τοπογραφικό** — και, αν δεν διαβάζεται, **τι να κάνεις** (ADR-920 Β4.9).
 * @related hooks/listings/useTerrainSurveyImport (`loadFile` · `reading` · `read`) ·
 *   lib/terrain/survey-import/survey-file-read (`SurveyFileRefusal` — μία άρνηση ανά πράξη που οφείλει να προτείνει η οθόνη) ·
 *   components/shared/files/FileUploadZone (η ΜΙΑ ζώνη μεταφοράς αρχείων της εφαρμογής)
 * @module components/terrain/survey-import/SurveyFilePicker
 *
 * 🔑 **Η άρνηση λέει την ΠΡΑΞΗ** («αποθήκευσέ το ως .xlsx», «αποθήκευσε DXF κειμένου»), όχι «μη υποστηριζόμενο αρχείο».
 *   Ανακοινώνεται (`role="alert"`) τη στιγμή που εμφανίζεται.
 * 🔑 **Τίποτα δεν φεύγει από τον browser εδώ**: η ανάγνωση γίνεται τοπικά· στον διακομιστή πηγαίνει μόνο η κανονική πηγή,
 *   μετά τη δήλωση Δ2.
 */

import React from 'react';

import { FileUploadZone } from '@/components/shared/files/FileUploadZone';
import { Button } from '@/components/ui/button';
import type { TerrainSurveyImportApi } from '@/hooks/listings/useTerrainSurveyImport';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SURVEY_FILE_ACCEPT } from '@/lib/terrain/survey-import/survey-file-kind';

const NS = 'terrain-survey';

export interface SurveyFilePickerProps {
  readonly survey: Pick<TerrainSurveyImportApi, 'fileName' | 'reading' | 'read' | 'loadFile' | 'reset'>;
  readonly disabled?: boolean;
}

export function SurveyFilePicker({ survey, disabled = false }: SurveyFilePickerProps) {
  const { t } = useTranslation([NS]);
  const { fileName, reading, read, loadFile, reset } = survey;
  const onUpload = async (files: File[]) => {
    const [first] = files;
    if (first !== undefined) await loadFile(first);
  };
  return (
    <section className="flex flex-col gap-2" aria-busy={reading}>
      {fileName === null ? (
        <FileUploadZone
          onUpload={onUpload}
          accept={SURVEY_FILE_ACCEPT}
          multiple={false}
          enableCompression={false}
          disabled={disabled}
          uploading={reading}
          typesHint={t(`${NS}:file.typesHint`)}
        />
      ) : (
        <header className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 truncate text-sm text-foreground">{t(`${NS}:file.chosen`, { name: fileName })}</p>
          <Button type="button" variant="outline" size="sm" onClick={reset} disabled={disabled || reading}>
            {t(`${NS}:file.reset`)}
          </Button>
        </header>
      )}
      <p role="status" className="m-0 text-sm text-muted-foreground">{reading ? t(`${NS}:file.reading`) : ''}</p>
      {read?.road === 'refused' && (
        <p role="alert" className="m-0 rounded border border-destructive p-2 text-sm text-foreground">
          {t(`${NS}:read.refusals.${read.refusal}`)}
        </p>
      )}
    </section>
  );
}
