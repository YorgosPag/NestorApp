'use client';

/**
 * ADR-736 Φ4 — το **περιεχόμενο** του μητρώου εξωτερικών αναφορών (Revit *Manage Links*).
 *
 * Τέσσερις στήλες, ακριβώς όπως ο κλάδος: **Όνομα | Είδος | Κατάσταση | Ενέργεια**. Η σύνοψη
 * «9 από 10 βρέθηκαν» πάνω-πάνω, γιατί αυτή είναι η ερώτηση που έχει ο χρήστης όταν ανοίγει το
 * παράθυρο — όχι η λίστα.
 *
 * ## Οι τρεις αποφάσεις που το κάνουν να λέει την αλήθεια
 *
 * 1. **Το «λείπει» ΔΕΝ είναι σφάλμα.** Ουδέτερο χρώμα, καμία κόκκινη κορδέλα, κανένα εμπόδιο: το
 *    DXF κρατά διαδρομές, όχι bytes — ένα σχέδιο με 10 ανεπίλυτους συνδέσμους είναι απολύτως
 *    υγιές. Κόκκινο κρατιέται **μόνο** για πραγματική αποτυχία (ανέβασμα που έσκασε).
 * 2. **Τα μη υποστηριζόμενα είδη ΦΑΙΝΟΝΤΑΙ.** Ένα `xref`/underlay/OLE δηλώνεται ρητά ως «δεν
 *    αποδίδεται». Το «ξέρω ότι είσαι εδώ, δεν σε ζωγραφίζω» είναι ειλικρινές· το να μη
 *    φαίνεται καθόλου είναι το αρχικό σφάλμα σε άλλη μορφή.
 * 3. **Ένα κουμπί, τρεις δρόμοι.** Αρχεία, φάκελος ή `.zip` καταλήγουν στον ίδιο resolver —
 *    ο χρήστης δεν χρειάζεται να ξέρει τη διαφορά.
 *
 * @see ../../hooks/useExternalReferenceResolution — η κατάσταση και η ενέργεια
 * @see ./ExternalReferencesPalette — το κέλυφος (modeless, ADR-723 μοτίβο)
 */

import React, { useCallback, useRef, useState } from 'react';
import { FileSearch, FolderOpen } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useExternalReferenceResolution } from '../../hooks/useExternalReferenceResolution';
import { collectExternalReferenceCandidates } from '../../io/dxf-external-reference-intake';
import type { DxfExternalReference } from '../../types/dxf-external-reference';

/** Ό,τι δέχεται ο επιλογέας αρχείων: εικόνες + το πακέτο eTransmit. */
const CANDIDATE_ACCEPT = '.png,.jpg,.jpeg,.webp,.zip';

export const ExternalReferencesManager: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const { references, summary, ambiguous, failures, isResolving, canResolve, resolve } =
    useExternalReferenceResolution();

  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  /** Η αναφορά για την οποία ο χρήστης πάτησε «Εντοπισμός» — `null` = για όλες. */
  const [targetRefId, setTargetRefId] = useState<string | null>(null);

  const handlePicked = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const picked = Array.from(event.target.files ?? []);
      // Ο επιλογέας μηδενίζεται ΠΑΝΤΑ: αλλιώς η δεύτερη επιλογή του ΙΔΙΟΥ αρχείου δεν εκπέμπει
      // `change` και το κουμπί μοιάζει νεκρό (κλασική παγίδα του <input type="file">).
      event.target.value = '';
      if (picked.length === 0) return;

      const candidates = await collectExternalReferenceCandidates(picked);
      if (candidates.length === 0) return;

      // Στοχευμένος εντοπισμός με ΕΝΑ αρχείο = ρητή επιλογή του χρήστη: παρακάμπτει τη σκάλα
      // ταύτισης. Ο άνθρωπος έδειξε το αρχείο· ο αλγόριθμος δεν έχει λόγο να το ξανακρίνει.
      const overrides =
        targetRefId && candidates.length === 1
          ? new Map([[targetRefId, candidates[0]]])
          : undefined;
      setTargetRefId(null);
      await resolve(candidates, overrides);
    },
    [resolve, targetRefId],
  );

  const openPicker = useCallback((refId: string | null, folder: boolean): void => {
    setTargetRefId(refId);
    (folder ? folderInputRef : filesInputRef).current?.click();
  }, []);

  if (references.length === 0) {
    return (
      <p className={`${PANEL_LAYOUT.SPACING.LG} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted}`}>
        {t('externalReferencesPalette.empty')}
      </p>
    );
  }

  const ambiguousIds = new Set(ambiguous.map((a) => a.refId));
  const failureByRefId = new Map(failures.map((f) => [f.refId, f]));

  return (
    <section className={PANEL_LAYOUT.SPACING.GAP_MD}>
      <header className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.GAP_H_SM}`}>
        <div>
          <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>
            {t('externalReferencesPalette.summary', {
              resolved: summary.resolved,
              total: summary.total,
            })}
          </p>
          <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
            {t('externalReferencesPalette.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canResolve || isResolving}
            onClick={() => openPicker(null, false)}
          >
            <FileSearch className="mr-1 h-4 w-4" />
            {isResolving
              ? t('externalReferencesPalette.resolving')
              : t('externalReferencesPalette.locateAll')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canResolve || isResolving}
            onClick={() => openPicker(null, true)}
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {!canResolve && (
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.warning}`}>
          {t('externalReferencesPalette.noCompany')}
        </p>
      )}

      <table className={`w-full ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
        <thead>
          <tr className={colors.text.muted}>
            <th scope="col" className="text-left font-medium">{t('externalReferencesPalette.columns.name')}</th>
            <th scope="col" className="text-left font-medium">{t('externalReferencesPalette.columns.kind')}</th>
            <th scope="col" className="text-left font-medium">{t('externalReferencesPalette.columns.status')}</th>
            <th scope="col" className="text-right font-medium">{t('externalReferencesPalette.columns.action')}</th>
          </tr>
        </thead>
        <tbody>
          {references.map((reference) => (
            <ReferenceRow
              key={reference.id}
              reference={reference}
              isAmbiguous={ambiguousIds.has(reference.id)}
              failureCode={failureByRefId.get(reference.id)?.code}
              disabled={!canResolve || isResolving}
              onLocate={() => openPicker(reference.id, false)}
            />
          ))}
        </tbody>
      </table>

      {/* Οι δύο επιλογείς είναι κρυφοί: το ορατό στοιχείο είναι το κουμπί (ίδιο ιδίωμα με το
          DxfImportModal). `webkitdirectory` = ολόκληρος φάκελος με ένα κλικ. */}
      <input
        ref={filesInputRef}
        type="file"
        multiple
        accept={CANDIDATE_ACCEPT}
        onChange={(e) => void handlePicked(e)}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error — μη τυποποιημένο, αλλά υλοποιημένο σε Chrome/Edge/Safari/Firefox.
        webkitdirectory=""
        onChange={(e) => void handlePicked(e)}
        className="hidden"
      />
    </section>
  );
};

interface ReferenceRowProps {
  readonly reference: DxfExternalReference;
  readonly isAmbiguous: boolean;
  readonly failureCode?: string;
  readonly disabled: boolean;
  readonly onLocate: () => void;
}

/**
 * Υπόδειξη κελιού μέσω Radix tooltip αντί για native `title=` (CHECK 3.23).
 *
 * Ένα helper για **δύο** κελιά επίτηδες: η πλήρης διαδρομή και η εξήγηση κατάστασης κάνουν την ίδια
 * δουλειά (κείμενο σε hover/focus), οπότε δύο χωριστά inline `Tooltip` blocks θα ήταν sibling clone.
 * Όταν δεν υπάρχει `hint`, επιστρέφει σκέτο το παιδί — κανένας trigger, κανένα κόστος.
 */
const CellHint: React.FC<{ readonly hint?: string; readonly children: React.ReactNode }> = ({
  hint,
  children,
}) => {
  if (!hint) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block truncate">{children}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ReferenceRow: React.FC<ReferenceRowProps> = ({
  reference,
  isAmbiguous,
  failureCode,
  disabled,
  onLocate,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const isResolved = reference.status === 'resolved';

  return (
    <tr>
      {/* Η υπόδειξη κρατά την ΠΛΗΡΗ διαδρομή του σχεδίου: «Z:\Jobs\…» είναι το μόνο στοιχείο που
          επιτρέπει στον χρήστη να καταλάβει σε ποιον υπολογιστή ζούσε το αρχείο. */}
      <td className="max-w-[16rem]">
        <CellHint hint={reference.rawPath}>{reference.basename}</CellHint>
      </td>
      <td className={colors.text.muted}>{t(`externalReferencesPalette.kind.${reference.kind}`)}</td>
      <td className={isResolved ? colors.text.success : colors.text.muted}>
        <CellHint
          hint={
            isResolved
              ? undefined
              : t(`externalReferencesPalette.statusHint.${reference.status}`)
          }
        >
          {t(`externalReferencesPalette.status.${reference.status}`)}
        </CellHint>
      </td>
      <td className="text-right">
        {failureCode && (
          <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.error} mr-2`}>
            {t(`externalReferencesPalette.failure.${failureCode}`)}
          </span>
        )}
        {reference.kind === 'raster' && !isResolved && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onLocate}>
            {isAmbiguous
              ? t('externalReferencesPalette.ambiguousChoose')
              : t('externalReferencesPalette.locate')}
          </Button>
        )}
      </td>
    </tr>
  );
};
