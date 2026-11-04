import { notFound } from 'next/navigation';
import { findOwnedPO } from '@/services/procurement';
import { readPageIdentity } from '@/server/auth/page-identity';
import { getPoDetailUrl } from '@/lib/navigation/procurement-urls';
import { redirect } from '@/lib/workspace/server-navigation';

interface PurchaseOrderRedirectProps {
  params: Promise<{ workspace: string; id: string }>;
}

/**
 * Deep-link compatibility handler for audit trail and legacy links.
 * Fetches the PO to resolve its projectId, then redirects to the
 * canonical project-scoped URL (ADR-330 D1), μέσα στον ίδιο χώρο (ADR-875 §11).
 *
 * 🔒 ADR-923 Λ5β — η σελίδα διάβαζε την PO **χωρίς** εταιρεία και ανακατεύθυνε σε
 * `/projects/<projectId>/…` ακόμη και για ξένη PO: το `projectId` ξένης εταιρείας
 * έβγαινε στη γραμμή διεύθυνσης. Τώρα: ταυτότητα από το cookie (`readPageIdentity`,
 * ο SSoT των Server Components) → ο ίδιος φράχτης με το API (`findOwnedPO`). Ξένη,
 * ανύπαρκτη ή χωρίς εταιρική ταυτότητα ⇒ `notFound()`, ίδια απάντηση και για τα τρία.
 */
export default async function PurchaseOrderRedirect({ params }: PurchaseOrderRedirectProps) {
  const { workspace, id } = await params;
  const identity = await readPageIdentity();
  if (!identity.ok || identity.scope !== 'organization') notFound();

  const po = await findOwnedPO({ caller: identity.ctx, poId: id, action: 'deep-link', intent: 'read' });
  if (!po) notFound();
  redirect(getPoDetailUrl(po.projectId, id), workspace);
}
