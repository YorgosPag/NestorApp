/**
 * =============================================================================
 * SUPER ADMIN TYPES — ADR-145
 * =============================================================================
 *
 * Type definitions for the Super Admin AI Assistant system.
 * Super admins (owners) can issue commands via any channel (Telegram, Email)
 * and these are auto-approved without operator review.
 *
 * @module types/super-admin
 * @see ADR-145 (Super Admin AI Assistant)
 */

// ============================================================================
// CHANNEL IDENTITY
// ============================================================================

/**
 * Telegram channel identity for a super admin
 */
export interface SuperAdminTelegramIdentity {
  userId: string;
  chatId: string;
}

/**
 * Email channel identity for a super admin
 */
export interface SuperAdminEmailIdentity {
  addresses: string[];
}

/**
 * WhatsApp channel identity for a super admin
 */
export interface SuperAdminWhatsAppIdentity {
  phoneNumber: string;
}

/**
 * Messenger channel identity for a super admin
 */
export interface SuperAdminMessengerIdentity {
  /** Page-Scoped ID (PSID) — unique per user-page pair */
  psid: string;
}

/**
 * Instagram channel identity for a super admin
 */
export interface SuperAdminInstagramIdentity {
  /** Instagram-Scoped ID (IGSID) */
  igsid: string;
}

/**
 * Viber channel identity (placeholder — not yet implemented)
 */
export interface SuperAdminViberIdentity {
  phoneNumber: string;
}

// ============================================================================
// SUPER ADMIN IDENTITY
// ============================================================================

/**
 * A single super admin identity with multi-channel recognition
 *
 * @enterprise Config-driven — stored in Firestore for hot updates without redeploy
 */
export interface SuperAdminIdentity {
  /** Firebase Auth UID (null if admin has no Firebase account yet) */
  firebaseUid: string | null;
  /** Human-readable display name */
  displayName: string;
  /** Channel-specific identifiers */
  channels: {
    telegram?: SuperAdminTelegramIdentity;
    email?: SuperAdminEmailIdentity;
    whatsapp?: SuperAdminWhatsAppIdentity;
    messenger?: SuperAdminMessengerIdentity;
    instagram?: SuperAdminInstagramIdentity;
    viber?: SuperAdminViberIdentity;
  };
  /** Whether this admin identity is currently active */
  isActive: boolean;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 last update timestamp */
  updatedAt: string;
}

// ============================================================================
// REGISTRY DOCUMENT
// ============================================================================

/**
 * Firestore document structure for `settings/super_admin_registry`
 *
 * @enterprise Single source of truth for admin identities across all channels
 */
export interface SuperAdminRegistryDoc {
  /** List of all super admin identities */
  admins: SuperAdminIdentity[];
  /** Schema version for migration support */
  schemaVersion: number;
  /** ISO 8601 last update timestamp */
  updatedAt: string;
}

// ============================================================================
// RESOLUTION RESULT
// ============================================================================

/**
 * Channel through which an admin was identified
 */
export type AdminResolvedVia =
  | 'telegram_user_id'
  | 'email_address'
  | 'firebase_uid'
  | 'whatsapp_phone'
  | 'messenger_psid'
  | 'instagram_igsid'
  | 'viber_phone';

/**
 * Result of resolving a super admin from a channel identifier
 */
export interface SuperAdminResolution {
  /** The matched admin identity */
  identity: SuperAdminIdentity;
  /** How the admin was identified */
  resolvedVia: AdminResolvedVia;
}
