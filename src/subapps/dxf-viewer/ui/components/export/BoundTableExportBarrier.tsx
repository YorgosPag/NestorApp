'use client';

/**
 * 🔴 ADR-767 Δ4 — **Ο ΦΡΑΓΜΟΣ ΤΗΣ ΕΞΑΓΩΓΗΣ**: το `DXEVAL` του AutoCAD, με ρητή επιλογή.
 *
 * ## Γιατί φραγμός και όχι τυπωμένο σήμα
 * Το Δ4 καταγράφει ρητά ότι αυτό **δεν** ήταν η πρώτη επιλογή του Giorgio (είχε ζητήσει
 * έντονη ένδειξη ορατή και σε εκτύπωση/DXF), και ότι η σύσταση εγκρίθηκε μετά από τεκμήριο:
 * οι μεγάλοι **συμφωνούν στην ουσία** — μπαγιάτικο νούμερο δεν φτάνει σιωπηλά στο παραδοτέο —
 * αλλά το επιβάλλουν με **φραγμό** (`DXEVAL`), όχι με μελάνι (`FIELDDISPLAY`: *«not plotted»*).
 *
 * Ο λόγος σε μία πρόταση: **τυπωμένο σήμα «μπαγιάτικο» πάνω σε τοπογραφικό που υπογράφεται το
 * μετατρέπει σε προσχέδιο**· ο φραγμός εγγυάται το ίδιο χωρίς να λερώσει το παραδοτέο.
 *
 * ## 🔴🔴 ΚΑΜΙΑ ΠΡΟΕΠΙΛΕΓΜΕΝΗ ΕΠΙΛΟΓΗ — ΚΑΙ ΕΙΝΑΙ ΔΟΜΙΚΟ
 * Το §8 #6 ονομάζει τον κίνδυνο: *«ο φραγμός γίνεται παρακάμψιμος με `Enter` ⇒ κανείς δεν τον
 * διαβάζει»*. Ο χρήστης που μόλις πάτησε «Εξαγωγή» έχει ήδη το δάχτυλο στο `Enter`.
 *
 * ⚠️ **Το «μη βάλεις `autoFocus`» ΔΕΝ αρκεί**: το Radix εστιάζει από μόνο του το **πρώτο
 * εστιάσιμο** στοιχείο, δηλαδή η προεπιλογή είναι ήδη λάθος. Γι' αυτό το `onOpenAutoFocus`
 * στέλνει την εστίαση ρητά στο **κείμενο** — ο χρήστης πρέπει να **διαλέξει** πριν κάποιο
 * πλήκτρο κάνει οτιδήποτε. Ίδιο συμπέρασμα με το «Outdated Table» task dialog του AutoCAD,
 * όπου καμία επιλογή δεν είναι default.
 *
 * ## 🔴 Η έξοδος ΔΕΝ είναι συγκατάθεση
 * `Escape` και κλικ έξω σημαίνουν **ακύρωση**, ποτέ «εξάγω έτσι». Η ασφαλής έκβαση είναι
 * πάντα αυτή που **δεν** παράγει αρχείο.
 *
 * ## 🔴 «Δεν ξέρω» ≠ «διαφέρει»
 * Οι μπαγιάτικοι και οι **ανέλεγκτοι** πίνακες δηλώνονται **χωριστά**, γιατί απαιτούν άλλη
 * ενέργεια: ο ένας θέλει «Ανανέωση», ο άλλος διόρθωση της πηγής. Η ισοπέδωσή τους θα ήταν το
 * ψεύτικο πράσινο των N.11/N.12 μεταφερμένο σε διάλογο.
 *
 * @module subapps/dxf-viewer/ui/components/export/BoundTableExportBarrier
 * @see bim/table/binding/table-binding-export-guard.ts — η κρίση (καθαρή, χωρίς UI)
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ4, §8 #6
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BoundTableExportVerdict } from '../../../bim/table/binding/table-binding-export-guard';
import type { UncheckedBoundTable } from '../../../bim/table/binding/table-binding-export-guard';

export interface BoundTableExportBarrierProps {
  readonly verdict: BoundTableExportVerdict;
  /** Ο χρήστης **δήλωσε ρητά** ότι εξάγει έτσι. Ο καλών το καταγράφει (§8 #6). */
  readonly onProceed: () => void;
  /** Ακύρωση — και **κάθε** άλλη έξοδος (`Escape`, κλικ έξω, ✕). */
  readonly onCancel: () => void;
}

/**
 * Ο λόγος που ένας πίνακας δεν μπόρεσε να ελεγχθεί, σε γλώσσα του χρήστη.
 *
 * Χάρτης και όχι τριαδικό: η ένωση `TableSourceResolution['status']` μεγαλώνει όποτε
 * προστεθεί κλάδος στο μητρώο πηγών, και μια αλυσίδα `if` θα άφηνε τον νέο λόγο **αόρατο**
 * (ο χρήστης θα έβλεπε κενό εκεί που υπάρχει αιτία).
 */
const UNCHECKED_REASON_KEY: Readonly<Record<UncheckedBoundTable['reason'], string>> = {
  'source-not-wired': 'export.boundTables.reasonNotWired',
  'source-unavailable': 'export.boundTables.reasonUnavailable',
};

export function BoundTableExportBarrier({
  verdict,
  onProceed,
  onCancel,
}: BoundTableExportBarrierProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const bodyRef = React.useRef<HTMLParagraphElement>(null);

  /**
   * 🔴 Η εστίαση πάει στο **κείμενο**, όχι σε κουμπί — δες την κεφαλίδα. Χωρίς αυτό, το Radix
   * θα εστίαζε το πρώτο κουμπί και το `Enter` της προηγούμενης χειρονομίας θα το πατούσε.
   */
  const focusBody = React.useCallback((event: Event) => {
    event.preventDefault();
    bodyRef.current?.focus();
  }, []);

  /** Κάθε έξοδος που **δεν** είναι το ρητό «Εξαγωγή όπως είναι» σημαίνει ακύρωση. */
  const handleOpenChange = React.useCallback(
    (next: boolean) => { if (!next) onCancel(); },
    [onCancel],
  );

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent size="lg" onOpenAutoFocus={focusBody}>
        <DialogHeader>
          <DialogTitle>{t('export.boundTables.title')}</DialogTitle>
          <DialogDescription>{t('export.boundTables.description')}</DialogDescription>
        </DialogHeader>

        {/* `tabIndex={-1}` — εστιάσιμο **προγραμματιστικά**, ποτέ με `Tab`: ο χρήστης δεν
            πρέπει να περνά από ένα κενό στοιχείο για να φτάσει στις επιλογές. */}
        <p ref={bodyRef} tabIndex={-1} className="text-sm text-muted-foreground outline-none">
          {t('export.boundTables.examined', { count: verdict.examined })}
        </p>

        <section aria-label={t('export.boundTables.listLabel')} className="flex flex-col gap-2">
          {verdict.stale.length > 0 && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {t('export.boundTables.stale', { count: verdict.stale.length })}
            </p>
          )}
          {verdict.unchecked.length > 0 && (
            <React.Fragment>
              <p role="alert" className="text-sm font-medium text-destructive">
                {t('export.boundTables.unchecked', { count: verdict.unchecked.length })}
              </p>
              {/* Ο λόγος ονομάζεται **μία φορά ανά είδος**, όχι ανά πίνακα: δέκα πίνακες με
                  την ίδια αιτία είναι ένα πρόβλημα, όχι δέκα. */}
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {distinctReasons(verdict.unchecked).map((reason) => (
                  <li key={reason}>{t(UNCHECKED_REASON_KEY[reason])}</li>
                ))}
              </ul>
            </React.Fragment>
          )}
        </section>

        <p className="text-xs text-muted-foreground">{t('export.boundTables.proceedNote')}</p>

        {/* ⚠️ `type="button"` και στα δύο, ρητά: μια μελλοντική τοποθέτηση μέσα σε `<form>`
            θα έκανε το ένα implicit submit — δηλαδή θα ξαναγεννούσε το «Enter» που ο
            διάλογος υπάρχει για να αποτρέψει. Καμία `variant` δεν διεκδικεί προτεραιότητα. */}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('export.boundTables.cancel')}
          </Button>
          <Button type="button" variant="destructive" onClick={onProceed}>
            {t('export.boundTables.proceed')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Οι **διακριτοί** λόγοι, με σταθερή σειρά εμφάνισης (η σειρά του `verdict`). */
function distinctReasons(
  unchecked: readonly UncheckedBoundTable[],
): readonly UncheckedBoundTable['reason'][] {
  return [...new Set(unchecked.map((table) => table.reason))];
}
