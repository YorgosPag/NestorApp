/**
 * ADR-344 Phase 5.B — Text editing capability hook (Q8).
 *
 * Reads the current user's role from UserRoleContext and maps it via the
 * pure `capabilitiesForRole` function (text-edit-capabilities.ts). Role
 * matrix mirrors ADR-344 Q8.
 */

'use client';

import { useMemo } from 'react';
import { useUserRole } from '@/auth/contexts/UserRoleContext';
import {
  capabilitiesForRole,
  type TextEditCapabilities,
} from './text-edit-capabilities';

export type { TextEditCapabilities } from './text-edit-capabilities';
export { capabilitiesForRole } from './text-edit-capabilities';

export function useCanEditText(): TextEditCapabilities {
  const { user } = useUserRole();
  return useMemo(() => capabilitiesForRole(user?.role ?? null), [user?.role]);
}
