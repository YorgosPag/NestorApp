import { notFound } from 'next/navigation';
import { getPO } from '@/services/procurement';
import { getPoDetailUrl } from '@/lib/navigation/procurement-urls';
import { redirect } from '@/lib/workspace/server-navigation';

interface PurchaseOrderRedirectProps {
  params: Promise<{ workspace: string; id: string }>;
}

/**
 * Deep-link compatibility handler for audit trail and legacy links.
 * Fetches the PO to resolve its projectId, then redirects to the
 * canonical project-scoped URL (ADR-330 D1), μέσα στον ίδιο χώρο (ADR-875 §11).
 */
export default async function PurchaseOrderRedirect({ params }: PurchaseOrderRedirectProps) {
  const { workspace, id } = await params;
  const po = await getPO(id);
  if (!po) notFound();
  redirect(getPoDetailUrl(po.projectId, id), workspace);
}
