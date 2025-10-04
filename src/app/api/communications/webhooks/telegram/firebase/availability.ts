// /home/user/studio/src/app/api/communications/webhooks/telegram/firebase/availability.ts

import { isFirebaseAvailable as isAvailable } from '@/lib/firebase-admin';

export function isFirebaseAvailable(): boolean {
    return isAvailable();
}
