'use client';

/**
 * ADR-916 Φ-Ε1 — ο **φάκελος ιδιώτη** όπως τον βλέπει ο επαγγελματίας: τα αρχεία του εύρους του, ανά καρτέλα, με
 * «Άνοιγμα» και «Λήψη» μέσα από την **ίδια** πόρτα με τα άλλα είδη (`useCaseFileOpening` →
 * `/api/engagements/{id}/files/{fileId}`). Ο server κρίνει σε **κάθε** άνοιγμα (συμμετοχή · φάκελος · εύρος) και γράφει
 * το ίχνος στο βιβλίο του κατόχου· εδώ μόνο η λίστα και τα κουμπιά.
 *
 * @module components/conveyance/my-cases/EngagedDossierContent
 */

import React, { useMemo } from 'react';
import { Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCaseFileOpening } from '@/components/conveyance/shared/CaseFileOpening';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { CaseFileMode } from '@/lib/conveyance/case-activity';
import { formatDate } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { PropertyDossierFileTab } from '@/config/upload-entry-points/entries-property-dossier';
import type { EngagedDossierFile, EngagedDossierView } from '@/types/my-engagements';
import { DOSSIER_ROLE_KEY, DOSSIER_SPACE_KEYS, DOSSIER_TAB_KEY } from './dossier-space-labels';

type OpenDossierFile = (file: EngagedDossierFile, mode: CaseFileMode) => void;

function FileRow({ file, openFile }: { readonly file: EngagedDossierFile; readonly openFile: OpenDossierFile }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="min-w-0 truncate">
        <span className="font-medium">{file.fileName}</span>
        {file.addedAt && <span className={cn('ml-2 text-xs', colors.text.muted)}>{t(DOSSIER_SPACE_KEYS.addedOn, { date: formatDate(file.addedAt) })}</span>}
      </span>
      <span className="flex gap-1">
        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => openFile(file, 'view')}>
          <Eye className={iconSizes.xs} aria-hidden="true" />
          {t(DOSSIER_SPACE_KEYS.openFile)}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => openFile(file, 'download')}>
          <Download className={iconSizes.xs} aria-hidden="true" />
          {t(DOSSIER_SPACE_KEYS.download)}
        </Button>
      </span>
    </li>
  );
}

interface TabSectionProps {
  readonly tab: PropertyDossierFileTab;
  readonly view: EngagedDossierView;
  readonly openFile: OpenDossierFile;
}

function TabSection({ tab, view, openFile }: TabSectionProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const files = view.files.filter((file) => file.tab === tab);
  const labelKey = tab === 'floorplan' ? DOSSIER_TAB_KEY[view.floorplanKind] : DOSSIER_TAB_KEY[tab];
  const headingId = `dossier-tab-${tab}`;
  return (
    <Card asChild className="space-y-2 p-4">
      <section aria-labelledby={headingId}>
        <h2 id={headingId} className="m-0 text-sm font-semibold">{t(labelKey)}</h2>
        {files.length === 0
          ? <p className={cn('m-0 text-xs', colors.text.muted)}>{t(DOSSIER_SPACE_KEYS.empty)}</p>
          : <ul className="space-y-1">{files.map((file) => <FileRow key={file.fileId} file={file} openFile={openFile} />)}</ul>}
      </section>
    </Card>
  );
}

export function EngagedDossierContent({ view }: { readonly view: EngagedDossierView }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const fileTarget = useMemo(() => ({ kind: 'engagement' as const, engagementId: view.engagementId }), [view.engagementId]);
  const { openFile, previewDialog } = useCaseFileOpening(fileTarget);
  return (
    <article className="flex flex-col gap-4">
      <header className="space-y-1">
        <h1 className="m-0 text-lg font-semibold text-foreground">{view.dossierLabel}</h1>
        <p className="m-0 text-sm text-foreground">
          {t(DOSSIER_SPACE_KEYS.kindLabel)} · {t(DOSSIER_SPACE_KEYS.roleLine, { role: t(DOSSIER_ROLE_KEY[view.role]) })}
        </p>
        <p className={cn('m-0 text-xs', colors.text.muted)}>
          {t(DOSSIER_SPACE_KEYS.expiresLine, { date: formatDate(view.expiresAt) })} · {t(DOSSIER_SPACE_KEYS.auditNotice)}
        </p>
      </header>
      {view.tabs.map((tab) => <TabSection key={tab} tab={tab} view={view} openFile={openFile} />)}
      {previewDialog}
    </article>
  );
}
