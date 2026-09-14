'use client';

/**
 * @fileoverview 🏆 **«ΕΙΣΑΓΩΓΗ ΑΠΟ ΤΑ ΣΤΟΙΧΕΙΑ ΤΗΣ ΕΤΑΙΡΕΙΑΣ» ΣΤΗΝ ΚΑΡΤΑ** — κουμπί με μέτρηση, διάλογος, αναίρεση
 *   (ADR-841 §7 Α21.19).
 * @related components/mandate/ShowcaseCardSection.tsx · hooks/mandate/useCompanyContactSource.ts
 * @module components/mandate/ShowcaseCardImportControl
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΖΩΝΤΑΝΗ ΕΝΔΕΙΞΗ — ΧΩΡΙΣ ΑΠΟΘΗΚΕΥΣΗ, ΧΩΡΙΣ ΣΥΓΧΡΟΝΙΣΜΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το κουμπί **μετρά** τις διαφορές κάρτας ⇄ εταιρείας σε κάθε απόδοση (Google Business Profile «Google updates» ·
 * PatternFly stale-data). Αν αύριο αλλάξει το τηλέφωνο της εταιρείας, η κάρτα **δεν** αλλάζει (ADR-827 §9.9 β) —
 * αλλά το κουμπί γράφει «1 διαφορά». Κανένα αποτύπωμα στη βάση που θα έπρεπε να συντηρείται.
 *
 * ⚠️ **Αναίρεση μόνο όσο ο άνθρωπος δεν έχει αγγίξει τίποτα μετά** (σύγκριση ταυτότητας πινάκων): αναίρεση που
 * θα έσβηνε και όσα έγραψε **μετά** την εισαγωγή θα ήταν απώλεια δουλειάς με κουμπί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΟ `dynamic` ΤΟΥ ΔΙΑΛΟΓΟΥ ΕΙΝΑΙ ΤΟ ΟΡΙΟ ΤΗΣ ΚΛΕΙΣΤΟΤΗΤΑΣ (CHECK 3.34) — ΜΗΝ ΤΟ ΚΑΝΕΙΣ ΣΤΑΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πίνακας σύγκρισης (στήλες, καταστάσεις γραμμής, «κράτα/πάρε») φαίνεται **μόνο μετά από κλικ**· στατικός
 * φούσκωνε το slice της κάρτας. Ίδιο ιδίωμα με `AccountEmailField` / `FirstContactAction` (ADR-844).
 * 🔑 Ο διάλογος **αποδίδεται πάντα** (κλειστός): το chunk και το namespace του φορτώνουν αμέσως μετά το πρώτο
 * βάψιμο, **πριν** μπορέσει να πατηθεί το κουμπί — όχι τη στιγμή της απόφασης. Στατικά μένουν ό,τι ζωγραφίζεται
 * στο πρώτο καρέ: ετικέτα κουμπιού, προέλευση, εντοπισμός.
 */

import React from 'react';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCompanyContactSource } from '@/hooks/mandate/useCompanyContactSource';
import {
  applyImport,
  compareCardWithSource,
  differenceCount,
  type ImportDecisions,
} from '@/lib/agency/showcase-card-import';
import type { ShowcaseLocationDraft } from '@/lib/agency/showcase-card-draft';
import { COMPANY_SETTINGS_ROUTE } from '@/lib/mandate/mandate-routes';
import { Link } from '@/lib/workspace/navigation';
import type { ImportOrigin } from '@/types/showcase-card-import';
import { SHOWCASE_CARD_IMPORT_KEYS } from '@/components/mandate/agency-showcase-import-labels';
import { SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';

/** Όριο κλειστότητας (CHECK 3.34) — δες το κεφάλι του αρχείου. */
const ShowcaseCardImportDialog = dynamic(
  () => import('./ShowcaseCardImportDialog').then((mod) => mod.ShowcaseCardImportDialog),
  { ssr: false },
);

export interface ShowcaseCardImportControlProps {
  readonly enabled: boolean;
  readonly drafts: readonly ShowcaseLocationDraft[];
  readonly website: string;
  readonly onReplace: (drafts: readonly ShowcaseLocationDraft[], website: string, websiteOrigin: ImportOrigin | null) => void;
}

interface Undoable {
  readonly before: { readonly drafts: readonly ShowcaseLocationDraft[]; readonly website: string };
  readonly after: { readonly drafts: readonly ShowcaseLocationDraft[]; readonly website: string };
  readonly applied: number;
}

function NoCompanyData(): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    <p className="m-0 text-sm text-muted-foreground">
      {t(SHOWCASE_CARD_IMPORT_KEYS.noCompanyData)}{' '}
      <Link href={COMPANY_SETTINGS_ROUTE} className="font-medium text-foreground underline underline-offset-4">
        {t(SHOWCASE_CARD_IMPORT_KEYS.companySettings)}
      </Link>
    </p>
  );
}

export function ShowcaseCardImportControl({ enabled, drafts, website, onReplace }: ShowcaseCardImportControlProps): React.ReactElement | null {
  const { t } = useTranslation([SHOWCASE_NS]);
  const source = useCompanyContactSource(enabled);
  const [open, setOpen] = React.useState(false);
  const [undoable, setUndoable] = React.useState<Undoable | null>(null);
  const comparison = React.useMemo(
    () => (source.phase === 'present' ? compareCardWithSource(drafts, website, source.source) : null),
    [source, drafts, website],
  );

  if (source.phase === 'absent') return <NoCompanyData />;
  if (source.phase === 'failed') return <p role="status" className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_CARD_IMPORT_KEYS.sourceFailed)}</p>;
  if (comparison === null) return null;

  const count = differenceCount(comparison);
  const reviewable = comparison.rows.some(({ status }) => status !== 'same');
  const pendingUndo =
    undoable !== null && undoable.after.drafts === drafts && undoable.after.website === website ? undoable : null;

  const apply = (decisions: ImportDecisions) => {
    const result = applyImport(drafts, website, comparison, decisions);
    setUndoable({ before: { drafts, website }, after: { drafts: result.drafts, website: result.website }, applied: result.applied });
    onReplace(result.drafts, result.website, result.websiteOrigin);
    setOpen(false);
  };
  const undo = () => {
    if (undoable === null) return;
    onReplace(undoable.before.drafts, undoable.before.website, null);
    setUndoable(null);
  };

  return (
    <section className="flex flex-wrap items-center gap-3" aria-live="polite">
      <Button type="button" variant="outline" disabled={!reviewable} onClick={() => setOpen(true)}>
        {count > 0 ? t(SHOWCASE_CARD_IMPORT_KEYS.openWithCount, { count }) : reviewable ? t(SHOWCASE_CARD_IMPORT_KEYS.review) : t(SHOWCASE_CARD_IMPORT_KEYS.upToDate)}
      </Button>
      {pendingUndo !== null ? (
        <span role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          {t(SHOWCASE_CARD_IMPORT_KEYS.applied, { count: pendingUndo.applied })}
          <Button type="button" variant="link" size="sm" onClick={undo}>{t(SHOWCASE_CARD_IMPORT_KEYS.undo)}</Button>
        </span>
      ) : null}
      <ShowcaseCardImportDialog open={open} onOpenChange={setOpen} comparison={comparison} onApply={apply} />
    </section>
  );
}
