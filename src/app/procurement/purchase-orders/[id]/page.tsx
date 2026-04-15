import { redirect } from 'next/navigation';

interface PurchaseOrderRedirectProps {
  params: Promise<{ id: string }>;
}

/**
 * Canonical purchase order deep-link handler.
 * Redirects `/procurement/purchase-orders/:id` → `/procurement/:id`.
 * The actual detail route is /procurement/[poId].
 */
export default async function PurchaseOrderRedirect({ params }: PurchaseOrderRedirectProps) {
  const { id } = await params;
  redirect(`/procurement/${id}`);
}
