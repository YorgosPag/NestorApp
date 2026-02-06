// /home/user/studio/src/app/api/communications/webhooks/telegram/firebase/availability.ts

import { isFirebaseAdminAvailable as isAvailable } from '@/lib/firebaseAdmin';

export function isFirebaseAvailable(): boolean {
    return isAvailable();
}
