/**
 * Shared label resolver for ADR-319 contact address types.
 *
 * Rules:
 *   - `other` with a non-empty `customLabel` → the custom text (trimmed)
 *   - everything else → `addresses.types.<key>` via the caller's `t` fn
 *
 * Callers pass their already-instantiated `tAddr` to keep the hook graph flat.
 */

import type { ContactAddressType } from '@/types/contacts/address-types';

type TFn = (key: string) => string;

export function resolveContactAddressLabel(
  type: ContactAddressType,
  customLabel: string | undefined,
  tAddr: TFn,
): string {
  if (type === 'other' && customLabel?.trim()) return customLabel.trim();
  return tAddr(`types.${type}`);
}
