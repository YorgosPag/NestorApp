'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function RoleManagementPage() {
  const RoleManagement = LazyRoutes.AdminRoleManagement;
  return <RoleManagement />;
}
