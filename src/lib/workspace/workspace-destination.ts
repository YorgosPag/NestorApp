/**
 * @fileoverview **«Σε ποιον χώρο ανοίγει αυτή η διαδρομή, για ΑΥΤΟΝ τον άνθρωπο;»**
 * @module lib/workspace/workspace-destination
 * @see ADR-787 §5.3 ιβ (το δίχτυ) · ADR-807 · ADR-819 §4.1 · ADR-848 (ο σύνδεσμος email)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ MODULE
 * ────────────────────────────────────────────────────────────────────────────
 * Η απάντηση ζούσε **μέσα** στο `(app)/[...unprefixed]/page.tsx`, ως κώδικας
 * σελίδας. Ο σύνδεσμος του email (`/n/{id}`) κάνει **την ίδια ερώτηση** για
 * διαδρομή που διάβασε από την ειδοποίηση. Αντίγραφο εκεί θα ήταν δεύτερη απάντηση
 * σε ερώτηση ασφαλείας — και η επόμενη διόρθωση (όπως η ADR-807, όπου ο κλάδος του
 * ιδιώτη ήταν **δομικά νεκρός**) θα έφτανε μόνο στη μία.
 *
 * ⚠️ **Δεν αποφασίζει ιδιότητα μέλους.** Μόνο **διευθυνσιοδοτεί** τον χώρο του
 * ανθρώπου· την άδεια την κρίνει το `o/[workspace]/layout.tsx` με τον κριτή του
 * (`resolveWorkspaceFromPath`, CHECK 3.58) τη στιγμή της άφιξης. Μια διεύθυνση που
 * φτιάχτηκε λάθος καταλήγει σε **404**, ποτέ σε ξένα δεδομένα.
 */

import 'server-only';

import type { PageIdentity } from '@/server/auth/page-identity';

import { workspacePath } from './workspace-path';
import { workspaceSegmentFor, type WorkspaceOwner } from './workspace-segment';

/** Η ταυτότητα **με** συνεδρία — η μόνη για την οποία η ερώτηση έχει νόημα. */
export type SignedInPageIdentity = Extract<PageIdentity, { readonly ok: true }>;

/**
 * Ο ιδιοκτήτης του χώρου του ανθρώπου.
 *
 * ⚠️ Ο έλεγχος είναι στο **`scope`** και όχι σε `hasOrganization(ctx)` (ADR-807):
 * το `ctx` του προσωπικού χώρου **δεν έχει καν** πεδίο `companyId`, οπότε η ερώτηση
 * «έχει οργανισμό;» πάνω του δεν είναι απλώς περιττή — είναι λάθος ερώτηση.
 */
export function workspaceOwnerOf(identity: SignedInPageIdentity): WorkspaceOwner {
  return identity.scope === 'organization'
    ? { kind: 'organization', companyId: identity.ctx.companyId }
    : { kind: 'personal' };
}

/**
 * **Η διαδρομή, μέσα στον χώρο του ανθρώπου** — `/listings/x` ⇒ `/o/<χώρος>/listings/x`.
 *
 * Το ερώτημα της διαδρομής επιβιώνει αυτούσιο: το `workspacePath` προσθέτει πρόθεμα,
 * δεν ξαναγράφει την ουρά.
 *
 * ⚠️ **ΠΕΤΑ όταν ο χώρος δεν έχει διεύθυνση — ΟΧΙ `notFound()`** (ADR-819 §5 Α7):
 * «ο χώρος σου δεν έχει διεύθυνση» δεν επιτρέπεται να φορέσει τη στολή του «δεν
 * υπάρχει». Είναι **χαλασμένη παροχή** και οφείλει να **φανεί** στα ίχνη.
 */
export async function workspaceDestinationFor(
  identity: SignedInPageIdentity,
  path: string,
): Promise<string> {
  const resolution = await workspaceSegmentFor(workspaceOwnerOf(identity));

  if (resolution.outcome === 'unaddressable') {
    throw new Error(
      `[ADR-819] Ο χώρος ${resolution.companyId} δεν έχει διεύθυνση: ούτε ψευδώνυμο στο έγγραφό του, ούτε έγκυρη ταυτότητα χώρου.`,
    );
  }

  return workspacePath(resolution.segment, path);
}
