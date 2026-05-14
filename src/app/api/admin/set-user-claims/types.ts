import type { GlobalRole, PermissionId } from '@/lib/auth';

export interface SetUserClaimsRequest {
  uid: string;
  companyId: string;
  globalRole: GlobalRole;
  email: string;
  permissions?: PermissionId[];
}

export interface SetUserClaimsResponse {
  success: boolean;
  message: string;
  user?: {
    uid: string;
    email: string;
    companyId: string;
    globalRole: GlobalRole;
    permissions?: PermissionId[];
    customClaimsSet: boolean;
    firestoreDocCreated: boolean;
  };
  error?: string;
  warning?: string;
}
