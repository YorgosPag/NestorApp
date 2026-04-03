import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';

interface ToggleMessagePinInput {
  messageId: string;
  action: 'pin' | 'unpin';
}

interface ToggleMessagePinResult {
  pinned: boolean;
  messageId: string;
  pinnedAt?: string;
}

interface EditMessageInput {
  messageId: string;
  newText: string;
}

interface EditMessageResult {
  edited: boolean;
  messageId: string;
}

export async function toggleMessagePinWithPolicy(
  input: ToggleMessagePinInput,
): Promise<ToggleMessagePinResult> {
  return apiClient.post<ToggleMessagePinResult>(API_ROUTES.MESSAGES.PIN, input);
}

export async function editMessageWithPolicy(
  input: EditMessageInput,
): Promise<EditMessageResult> {
  return apiClient.patch<EditMessageResult>(API_ROUTES.MESSAGES.EDIT, input);
}
