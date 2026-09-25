/**
 * =============================================================================
 * 🏢 ENTERPRISE: Link-Token Panel — Draft & Result Types
 * =============================================================================
 *
 * @module components/ui/sharing/panels/link-token/types
 * @see ADR-147 Unified Share Surface · ADR-315 §5 (διαχείριση συνδέσμων)
 */

export interface LinkTokenDraft {
  /** ADR-315 Α14 — εσωτερική ετικέτα «για ποιον»· ο παραλήπτης δεν τη βλέπει ποτέ. */
  label: string;
  expiresInHours: string;
  /**
   * Δημιουργία: ο κωδικός (κενό = χωρίς κωδικό).
   * Αλλαγή ρυθμίσεων: **νέος** κωδικός (κενό = αμετάβλητος — ο παλιός δεν ξαναδιαβάζεται ποτέ).
   */
  password: string;
  /** Μόνο στην αλλαγή ρυθμίσεων συνδέσμου **με** κωδικό: αφαίρεση του κωδικού. */
  removePassword: boolean;
  maxDownloads: string;
  note: string;
}

export interface LinkTokenResultData {
  url: string;
  expiresInHoursLabel: string;
  maxDownloadsCount: number;
  passwordProtected: boolean;
}

export const INITIAL_LINK_TOKEN_DRAFT: LinkTokenDraft = {
  label: '',
  expiresInHours: '72',
  password: '',
  removePassword: false,
  maxDownloads: '0',
  note: '',
};
