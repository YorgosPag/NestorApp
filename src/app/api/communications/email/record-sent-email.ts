import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { AuthContext } from '@/lib/auth';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { generateMessageDocId } from '@/server/lib/id-generation';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RecordSentEmail');

interface RecordSentEmailSpec {
  readonly auth: AuthContext;
  readonly contactId: string;
  readonly opportunityId?: string;
  readonly to: string;
  readonly subject: string;
  readonly content: string;
  readonly providerMessageId?: string;
}

/**
 * Γράφει το email που μόλις έφυγε στο ιστορικό επικοινωνιών της επαφής.
 *
 * Επιστρέφει `null` αντί να ρίξει: όταν φτάνει εδώ το email έχει ήδη σταλεί, και αποτυχία
 * εγγραφής δεν επιτρέπεται να φανεί στον χρήστη ως «δεν στάλθηκε». Το αναγνωριστικό παράγεται
 * από το id του παρόχου, ώστε δεύτερη κλήση για το ίδιο email να μη φτιάχνει δεύτερη γραμμή.
 */
export async function recordSentEmail(spec: RecordSentEmailSpec): Promise<string | null> {
  const { auth, contactId, opportunityId, to, subject, content, providerMessageId } = spec;

  try {
    const contact = await getAdminFirestore().collection(COLLECTIONS.CONTACTS).doc(contactId).get();
    if (!isPayloadOwnedByCompany(contact.data(), auth.companyId)) {
      logger.warn('Sent email not recorded: contact outside tenant', { contactId, companyId: auth.companyId });
      return null;
    }

    const { id } = await createEntity('sentEmailRecord', {
      auth,
      parentId: null,
      explicitId: providerMessageId
        ? generateMessageDocId(COMMUNICATION_CHANNELS.EMAIL, contactId, providerMessageId)
        : undefined,
      entitySpecificFields: {
        contactId,
        ...(opportunityId ? { opportunityId } : {}),
        type: COMMUNICATION_CHANNELS.EMAIL,
        channel: COMMUNICATION_CHANNELS.EMAIL,
        direction: 'outbound',
        to,
        subject,
        content,
        status: 'sent',
        ...(providerMessageId ? { providerMessageId } : {}),
      },
    });
    return id;
  } catch (error) {
    logger.error('Failed to record sent email', { error, contactId });
    return null;
  }
}
