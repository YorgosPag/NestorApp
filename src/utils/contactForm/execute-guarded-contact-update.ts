import { createModuleLogger } from '@/lib/telemetry';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { mapFormDataToContact } from '@/utils/contactForm/modular/orchestrator';

const logger = createModuleLogger('ExecuteGuardedContactUpdate');

interface NotificationApi {
  error: (message: string) => void;
}

interface GuardMutationResult {
  readonly completed: boolean;
  readonly blockedUnsafeClear: boolean;
}

interface ExecuteGuardedContactUpdateParams {
  readonly formData: ContactFormData;
  readonly notifications: NotificationApi;
  readonly previewBeforeUpdate: (
    formData: ContactFormData,
    contactData: Record<string, unknown>,
    action: () => Promise<void>,
  ) => Promise<GuardMutationResult>;
  readonly action: () => Promise<void>;
  readonly logScope: string;
}

export async function executeGuardedContactUpdate({
  formData,
  notifications,
  previewBeforeUpdate,
  action,
  logScope,
}: ExecuteGuardedContactUpdateParams): Promise<boolean> {
  const mappingResult = mapFormDataToContact(formData);
  if (mappingResult.warnings.length > 0) {
    logger.warn(`${logScope}: Mapping warnings`, { warnings: mappingResult.warnings });
  }

  const mutationResult = await previewBeforeUpdate(formData, mappingResult.contactData, action);
  if (mutationResult.blockedUnsafeClear) {
    notifications.error('common-shared.contacts.companyIdentityImpact.unsafeClear');
    return false;
  }

  return mutationResult.completed;
}
