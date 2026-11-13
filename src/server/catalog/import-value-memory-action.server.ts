import 'server-only';

/**
 * Η **ρητή εφαρμογή και αναίρεση της μνήμης τιμών** σε παρτίδα που ήδη διαβάστηκε (ADR-923 §5.5.2 Β10) — το δεύτερο μισό του κουμπιού
 * «Εφαρμογή μνήμης / Αναίρεση όλων από μνήμη» (`import-memory-apply.server`), μετά τις γραμμές.
 *
 * 🔑 **Καμία δεύτερη διαδρομή εγγραφής**: κάθε αλλαγή είναι αίτημα διόρθωσης στον **ίδιο** γραφέα (`updateImportProposal`): `revert` +
 *    `fallback: 'memory'` για εφαρμογή, `revert` για αναίρεση. Ίδιος κριτής, ίδιο σχέδιο, ίδιος έλεγχος αναθεώρησης.
 * 🔑 Μόνο εκκρεμείς προτάσεις ιδιοτήτων· εγκεκριμένη πρόταση δεν αλλάζει από εδώ.
 * @module server/catalog/import-value-memory-action.server
 */

import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { isMemoryOverride } from '@/subapps/catalog/import/label-memory';
import type { ImportBatchDefinition } from '@/subapps/catalog/types/catalog-import';
import type { ImportFieldEditInput, ImportMemoryActionRequest, ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { runCatalogReadOnly } from './catalog-store.server';
import { updateImportProposal } from './import-proposal-writer.server';
import { readValueMemoryEdits } from './import-value-memory.server';

const revertInput = ({ rowKey, targetKey }: { readonly rowKey: string; readonly targetKey: string }): ImportFieldEditInput => ({ rowKey, targetKey, text: '', revert: true });

/** Τα πεδία μιας πρότασης όπου η μνήμη έχει απάντηση σήμερα (ίδιος κανόνας με τη γέννηση): αιτήματα «επιστροφή στη μνήμη». */
async function applyInputs(ctx: AuthContext, batch: ImportBatchDefinition, proposal: ImportProposalWire): Promise<ImportFieldEditInput[]> {
  const stamp = { by: ctx.uid, at: nowISO() };
  const found = await runCatalogReadOnly(ctx, (scope) => readValueMemoryEdits(scope, batch, proposal.extracted, proposal.edits, stamp));
  return found.map((edit) => ({ ...revertInput(edit), fallback: 'memory' as const }));
}

/** Οι διορθώσεις που έβαλε η μνήμη: φεύγουν, ισχύει ξανά η πηγή. Του ανθρώπου μένουν. */
const undoInputs = (proposal: ImportProposalWire): ImportFieldEditInput[] => (proposal.edits ?? []).filter(isMemoryOverride).map(revertInput);

/** Εφαρμογή ή αναίρεση της μνήμης τιμών σε κάθε εκκρεμή πρόταση ιδιοτήτων. Επιστρέφει πόσα πεδία άλλαξαν. */
export async function runValueMemoryAction(
  ctx: AuthContext,
  batch: ImportBatchDefinition,
  proposals: readonly ImportProposalWire[],
  action: ImportMemoryActionRequest['action'],
): Promise<number> {
  let fields = 0;
  for (const proposal of proposals.filter((each) => each.status === 'pending' && each.purpose === 'attributes')) {
    const edits = action === 'apply' ? await applyInputs(ctx, batch, proposal) : undoInputs(proposal);
    if (edits.length === 0) continue;
    await updateImportProposal(ctx, proposal.id, { expectedRevision: proposal.revision, decisions: [], edits, modelCode: null });
    fields += edits.length;
  }
  return fields;
}
