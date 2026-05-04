/**
 * 🏢 VENDOR CARD — Shared Types
 *
 * Shared payload type for VendorListCard / VendorGridCard.
 * Combines a Contact (supplier persona) with optional SupplierMetrics.
 *
 * @see VendorListCard, VendorGridCard
 */

import type { Contact } from '@/types/contacts';
import type { SupplierMetrics } from '@/types/procurement';

export interface VendorCardData {
  contact: Contact;
  metrics: SupplierMetrics | null;
}
