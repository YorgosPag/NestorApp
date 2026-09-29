/**
 * 🔐 ENTERPRISE SESSION SERVICE (client)
 *
 * Active-session tracking across devices — Google «Your devices» / GitHub «Sessions» patterns.
 *
 * ADR-894: ο client **μόνο διαβάζει** τις εγγραφές (`users/{uid}/sessions`, κανόνας `write: if false`).
 * Κάθε εγγραφή περνά από τις διαδρομές `/api/auth/active-sessions/**`, όπου ο server διαβάζει UA, IP και
 * τοποθεσία από το **ίδιο** το αίτημα (`session-server.service.ts`). Μέχρι τις 2026-09-29 ο browser τα
 * έγραφε μόνος του, με τοποθεσία από το `ipapi.co` — πλαστογραφήσιμη, και με την IP σε τρίτο.
 *
 * Split into SRP modules (ADR-065):
 * - session-device-detection.ts — device/browser/OS detection (pure, server-side)
 * - session-helpers.ts — pure functions: data mapping, display, statistics
 *
 * @module services/session/EnterpriseSessionService
 */

import {
  collection,
  documentId,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import type { DocumentData, Firestore } from 'firebase/firestore';
import { adoptIssuedSession } from '@/auth/issued-session';
import type { SessionContinuation } from '@/server/auth/session-reissue';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { API_ROUTES } from '@/config/domain-constants';
import { SUBCOLLECTIONS, COLLECTIONS } from '@/config/firestore-collections';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { safeGetItem, safeRemoveItem, safeSetItem, STORAGE_KEYS } from '@/lib/storage/safe-storage';
import type {
  UserSession,
  LoginMethod,
  SessionQueryFilters,
  SessionStatistics,
  SessionsOverviewDisplay,
  SessionActionResult,
  SyncActiveSessionInput,
  SyncActiveSessionResult,
} from './session.types';
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { detectBrowser, detectOS, getClientDeviceHints } from './session-device-detection';
import {
  mapDocToSession,
  formatSessionsForDisplay,
  formatEndedSessionsForDisplay,
  computeSessionStatistics,
  isSessionLive
} from './session-helpers';
import { partitionSessionsOverview, SESSION_HISTORY_WINDOW_DAYS, type SessionsOverview } from './session-lifecycle';

const DAY_MS = 24 * 60 * 60 * 1000;

const logger = createModuleLogger('EnterpriseSessionService');

/** Όνομα του Web Lock — ένα ανά χρήστη, κοινό σε όλες τις καρτέλες του browser. */
const SYNC_LOCK_PREFIX = 'nestor-active-session-sync:';

function storageKeyOf(uid: string): string {
  return `${STORAGE_KEYS.ACTIVE_SESSION_PREFIX}${uid}`;
}

/**
 * Σειριοποίηση ανάμεσα σε καρτέλες (Web Locks API): δύο καρτέλες που ανοίγουν μαζί **δεν** φτιάχνουν δύο
 * εγγραφές — η δεύτερη περιμένει και βρίσκει το id της πρώτης. Χωρίς υποστήριξη ⇒ απευθείας εκτέλεση.
 */
function withBrowserLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) return task();
  return navigator.locks.request(name, task);
}

/**
 * ADR-894 §10 Β1 — ο server ανακάλεσε **όλες** τις συνδέσεις: η συσκευή συνεχίζει με το νέο κλειδί.
 * @returns `true` αν χρειάζεται νέα σύνδεση (δεν δόθηκε κλειδί, ή δεν υιοθετήθηκε).
 */
async function continueAfterRevocation(session: SessionContinuation | undefined): Promise<boolean> {
  if (!session || session.kind === 'unchanged') return false;
  if (session.kind === 'ended') return true;
  return (await adoptIssuedSession(session.token)).kind === 'not-signed-in';
}

function realtimeDeviceLabel(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  return `${detectBrowser(ua).type} on ${detectOS(ua).os}`;
}

// ============================================================================
// ENTERPRISE SESSION SERVICE
// ============================================================================

/**
 * Enterprise Session Service
 * Singleton service for managing user sessions
 */
export class EnterpriseSessionService {
  private static instance: EnterpriseSessionService;
  private db: Firestore | null = null;
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): EnterpriseSessionService {
    if (!EnterpriseSessionService.instance) {
      EnterpriseSessionService.instance = new EnterpriseSessionService();
    }
    return EnterpriseSessionService.instance;
  }

  /**
   * Initialize service with Firestore (reads only)
   */
  initialize(firestore: Firestore): void {
    this.db = firestore;
    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('EnterpriseSessionService not initialized. Call initialize(firestore) first.');
    }
  }

  private getSessionsCollection(userId: string) {
    this.ensureInitialized();
    return collection(this.db!, COLLECTIONS.USERS, userId, SUBCOLLECTIONS.USER_SESSIONS);
  }

  // ==========================================================================
  // SESSION LIFECYCLE (server-written, ADR-894)
  // ==========================================================================

  /** Η εγγραφή **αυτού** του browser για τον χρήστη, αν υπάρχει. */
  getCurrentSessionId(userId: string): string | null {
    // String fallback ⇒ ωμή ανάγνωση (το `safeSetItem` γράφει string ωμό· με fallback `null` θα γινόταν JSON.parse).
    return safeGetItem(storageKeyOf(userId), '') || null;
  }

  /**
   * «Αυτός ο browser είναι ενεργός» — μία φορά ανά φόρτωση, από οποιαδήποτε καρτέλα. Ο server αγγίζει
   * τη γνωστή εγγραφή ή γεννά νέα· το id που επιστρέφει γίνεται η μνήμη του browser.
   */
  async syncActiveSession(userId: string, loginMethod: LoginMethod): Promise<SyncActiveSessionResult> {
    return withBrowserLock(`${SYNC_LOCK_PREFIX}${userId}`, async () => {
      const body: SyncActiveSessionInput = {
        sessionId: this.getCurrentSessionId(userId),
        loginMethod,
        ...getClientDeviceHints(),
      };
      const result = await apiClient.post<SyncActiveSessionResult>(API_ROUTES.AUTH.ACTIVE_SESSIONS, body);
      safeSetItem(storageKeyOf(userId), result.sessionId);
      if (result.created) {
        RealtimeService.dispatch('SESSION_CREATED', {
          sessionId: result.sessionId,
          session: { userId, deviceInfo: realtimeDeviceLabel() },
          timestamp: Date.now(),
        });
      }
      return result;
    });
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionId: string): Promise<SessionActionResult> {
    try {
      const { session } = await apiClient.delete<{ session?: SessionContinuation }>(
        `${API_ROUTES.AUTH.ACTIVE_SESSION(sessionId)}?reason=user_requested`,
      );
      if (sessionId === this.getCurrentSessionId(userId)) safeRemoveItem(storageKeyOf(userId));

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('SESSION_DELETED', { sessionId, timestamp: Date.now() });
      const signInRequired = await continueAfterRevocation(session);
      return { success: true, affectedSessions: [sessionId], action: 'revoke', signInRequired };
    } catch (error) {
      logger.error('Failed to revoke session:', error);
      return { success: false, error: getErrorMessage(error), affectedSessions: [], action: 'revoke' };
    }
  }

  /**
   * Revoke all sessions except this browser's
   */
  async revokeAllOtherSessions(userId: string): Promise<SessionActionResult> {
    try {
      const keep = this.getCurrentSessionId(userId);
      const url = keep
        ? `${API_ROUTES.AUTH.ACTIVE_SESSIONS}?keep=${encodeURIComponent(keep)}`
        : API_ROUTES.AUTH.ACTIVE_SESSIONS;
      const { revokedSessionIds, session } = await apiClient.delete<{
        revokedSessionIds: string[];
        session?: SessionContinuation;
      }>(url);
      for (const sessionId of revokedSessionIds) {
        RealtimeService.dispatch('SESSION_DELETED', { sessionId, timestamp: Date.now() });
      }
      const signInRequired = await continueAfterRevocation(session);
      return { success: true, affectedSessions: revokedSessionIds, action: 'revoke_all', signInRequired };
    } catch (error) {
      logger.error('Failed to revoke all sessions:', error);
      return { success: false, error: getErrorMessage(error), affectedSessions: [], action: 'revoke_all' };
    }
  }

  /**
   * End this browser's session (logout). Ποτέ δεν ρίχνει: η αποσύνδεση δεν αποτυγχάνει επειδή απέτυχε η ανάκληση.
   * ⚠️ **Χωρίς** `SESSION_DELETED`: θα ξαναπυροδοτούσε το signOut αυτής της καρτέλας· τις άλλες καρτέλες
   * τις αποσυνδέει ήδη το Firebase Auth (κοινή κατάσταση ανά browser).
   */
  async endCurrentSession(userId: string): Promise<void> {
    const sessionId = this.getCurrentSessionId(userId);
    safeRemoveItem(storageKeyOf(userId));
    if (!sessionId) return;
    try {
      await apiClient.delete(`${API_ROUTES.AUTH.ACTIVE_SESSION(sessionId)}?reason=logout`);
    } catch (error) {
      logger.warn('Failed to end session on logout (non-blocking)', { error: getErrorMessage(error) });
    }
  }

  // ==========================================================================
  // SESSION QUERIES
  // ==========================================================================

  /**
   * Get all live sessions for a user (active **and** not expired)
   */
  async getActiveSessions(userId: string): Promise<UserSession[]> {
    const q = query(
      // 🔒 companyId: N/A — subcollection users/{userId}/sessions, tenant-isolated
      // via path + rule `allow read: if isOwner(userId)`. No companyId field.
      this.getSessionsCollection(userId),
      where('status', '==', 'active'),
      orderBy('timestamps.lastActiveAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const now = new Date();
    return snapshot.docs.map(docSnap => mapDocToSession(docSnap.data())).filter(s => isSessionLive(s, now));
  }

  /**
   * ADR-894 §10 Β2 — ζωντανές **και** όσες τελείωσαν τις τελευταίες 28 ημέρες (Google «Your devices»), από
   * **ένα** ερώτημα: εύρος και ταξινόμηση στο **ίδιο** πεδίο ⇒ αρκεί ο αυτόματος μονοπεδικός δείκτης.
   */
  async getSessionsOverview(userId: string, now: Date = new Date()): Promise<SessionsOverview<UserSession>> {
    const since = Timestamp.fromMillis(now.getTime() - SESSION_HISTORY_WINDOW_DAYS * DAY_MS);
    const q = query(
      // 🔒 companyId: N/A — subcollection users/{userId}/sessions, tenant-isolated via path + owner rule.
      this.getSessionsCollection(userId),
      where('timestamps.lastActiveAt', '>=', since),
      orderBy('timestamps.lastActiveAt', 'desc'),
    );
    const snapshot = await getDocs(q);
    return partitionSessionsOverview(snapshot.docs.map((docSnap) => mapDocToSession(docSnap.data())), now);
  }

  /**
   * Get all sessions for a user (including revoked/expired)
   */
  async getAllSessions(
    userId: string,
    filters?: SessionQueryFilters
  ): Promise<UserSession[]> {
    let q = query(this.getSessionsCollection(userId), orderBy('timestamps.createdAt', 'desc'));
    if (filters?.limit) {
      q = query(q, limit(filters.limit));
    }

    const snapshot = await getDocs(q);
    let sessions = snapshot.docs.map(docSnap => mapDocToSession(docSnap.data()));

    // Apply client-side filters
    if (filters?.status) {
      sessions = sessions.filter(s => s.status === filters.status);
    }
    if (filters?.activeOnly) {
      sessions = sessions.filter(s => isSessionLive(s));
    }
    if (filters?.deviceType) {
      sessions = sessions.filter(s => s.deviceInfo.type === filters.deviceType);
    }

    return sessions;
  }

  /**
   * Get session statistics for a user
   */
  async getSessionStatistics(userId: string): Promise<SessionStatistics> {
    const allSessions = await this.getAllSessions(userId);
    return computeSessionStatistics(allSessions);
  }

  // ==========================================================================
  // UI HELPERS
  // ==========================================================================

  /**
   * Get sessions formatted for UI display — «τρέχουσα» = η εγγραφή αυτού του browser.
   */
  async getSessionsForDisplay(userId: string): Promise<SessionsOverviewDisplay> {
    const { live, ended } = await this.getSessionsOverview(userId);
    return {
      live: formatSessionsForDisplay([...live], this.getCurrentSessionId(userId)),
      ended: formatEndedSessionsForDisplay(ended),
    };
  }

  /**
   * **Ανακλήθηκε αυτή η συσκευή;** — δύο κανάλια, ένας ακροατής:
   * - ίδιος browser, άλλη καρτέλα: `SESSION_DELETED` (ADR-228 Tier 1)·
   * - **άλλη συσκευή** (ADR-894 §10 Β1 — Google «Sign out» από τη λίστα): η δική μας εγγραφή, μέσω του
   *   `firestoreQueryService` (SSoT συνδρομών). Μέχρι τη Φάση 2 η άλλη συσκευή **δεν μάθαινε τίποτα**.
   * ⚠️ Μόνο `revoked` αποσυνδέει: το `expired` (αδράνεια) δεν είναι ανάκληση· και απούσα εγγραφή
   *   (πρώτο στιγμιότυπο από cache, ή σβήσιμο TTL) δεν είναι απόδειξη ανάκλησης.
   */
  static watchSessionRevocation(userId: string, currentSessionId: string, onSessionRevoked: () => void): () => void {
    let fired = false;
    const fire = (channel: string) => {
      if (fired) return;
      fired = true;
      logger.warn('Current session revoked — triggering logout', { channel });
      onSessionRevoked();
    };
    const offTabs = RealtimeService.subscribe('SESSION_DELETED', (payload) => {
      if (payload.sessionId === currentSessionId) fire('tab');
    });
    const offRemote = firestoreQueryService.subscribeSubcollection<DocumentData>(
      'USERS',
      userId,
      SUBCOLLECTIONS.USER_SESSIONS,
      (result) => {
        if (result.documents.some((doc) => doc.status === 'revoked')) fire('remote');
      },
      (error) => logger.warn('Session revocation watch failed', { error: getErrorMessage(error) }),
      { constraints: [where(documentId(), '==', currentSessionId)] },
    );
    return () => {
      offTabs();
      offRemote();
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default EnterpriseSessionService;

/** Singleton instance */
export const sessionService = EnterpriseSessionService.getInstance();
