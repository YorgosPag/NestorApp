/**
 * /admin/bim-diagnostics — Super-admin BIM Performance Diagnostics Dashboard
 *
 * Server wrapper. Auth gating handled by `src/app/admin/layout.tsx`
 * (`requireAdminForPage('ADMIN_SECTION_ACCESS')`). The PATCH/PUT API
 * routes additionally enforce `ctx.globalRole === 'super_admin'`
 * (defense in depth).
 *
 * @enterprise ADR-366 §C.7.Q2 — Admin Diagnostics Dashboard
 */

import { BimDiagnosticsView } from './BimDiagnosticsView';

export const metadata = {
  title: 'BIM Diagnostics | Nestor Admin',
};

export default function AdminBimDiagnosticsPage() {
  return <BimDiagnosticsView />;
}
