/**
 * @file Sync Service - Cross-Tab Synchronization
 * @module settings/io/SyncService
 *
 * ENTERPRISE STANDARD - Real-time cross-tab sync
 *
 * **FEATURES:**
 * - BroadcastChannel for modern browsers
 * - Storage event fallback for older browsers
 * - Monotonic version counter (prevents loops)
 * - Origin tags (ignore own updates)
 * - Last-writer-wins policy
 *
 * **TARGET:** <250ms sync latency
 *
 *  - Module #6
 */

import type { SettingsState } from '../core/types';
import { generateTempId } from '@/services/enterprise-id.service';

// ============================================================================
// SYNC MESSAGE TYPES
// ============================================================================

interface SyncMessage {
  type: 'SETTINGS_UPDATE';
  version: number;           // Monotonic version counter
  origin: string;            // Tab origin (prevent loops)
  timestamp: number;         // When update occurred
  changes: Partial<SettingsState>;
}

// ============================================================================
// SYNC SERVICE
// ============================================================================

export class SyncService {
  private channel: BroadcastChannel | null = null;
  private changeVersion = 0;   // Monotonic counter
  private origin: string;      // Unique tab identifier
  private listeners: Set<(changes: Partial<SettingsState>) => void> = new Set();
  private storageListenerBound: ((event: StorageEvent) => void) | null = null;

  constructor(
    private channelName = 'dxf_settings_sync'
  ) {
    this.origin = this.generateOrigin();
    this.initializeChannel();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Broadcast changes to other tabs
   *
   * @param changes - Partial settings state to broadcast
   */
  broadcast(changes: Partial<SettingsState>): void {
    this.changeVersion++;

    const message: SyncMessage = {
      type: 'SETTINGS_UPDATE',
      version: this.changeVersion,
      origin: this.origin,
      timestamp: Date.now(),
      changes
    };

    // Send via BroadcastChannel if available
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (error) {
        console.error('[SyncService] BroadcastChannel send failed:', error);
      }
    }

    // Also update localStorage for storage event fallback
    try {
      localStorage.setItem(
        `${this.channelName}_latest`,
        JSON.stringify(message)
      );
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Subscribe to changes from other tabs
   *
   * @param callback - Called when changes received from another tab
   * @returns Unsubscribe function
   */
  subscribe(callback: (changes: Partial<SettingsState>) => void): () => void {
    this.listeners.add(callback);

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Get current version counter
   *
   * @returns Current version
   */
  getVersion(): number {
    return this.changeVersion;
  }

  /**
   * Close sync service (cleanup)
   */
  close(): void {
    // Close BroadcastChannel
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    // Remove storage listener
    if (this.storageListenerBound) {
      window.removeEventListener('storage', this.storageListenerBound);
      this.storageListenerBound = null;
    }

    // Clear listeners
    this.listeners.clear();
  }

  // ==========================================================================
  // PRIVATE - INITIALIZATION
  // ==========================================================================

  private initializeChannel(): void {
    // Try BroadcastChannel first (modern browsers)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(this.channelName);

        this.channel.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.channel.onmessageerror = (error) => {
          console.error('[SyncService] BroadcastChannel message error:', error);
        };

        console.info('[SyncService] BroadcastChannel initialized');
      } catch (error) {
        console.warn('[SyncService] BroadcastChannel failed, using storage fallback');
        this.channel = null;
      }
    }

    // Setup storage event fallback (always, for compatibility)
    this.initializeStorageFallback();
  }

  private initializeStorageFallback(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    this.storageListenerBound = (event: StorageEvent) => {
      // Only listen to our key
      if (event.key !== `${this.channelName}_latest`) {
        return;
      }

      // Parse message
      if (!event.newValue) {
        return;
      }

      try {
        const message = JSON.parse(event.newValue) as SyncMessage;
        this.handleMessage(message);
      } catch (error) {
        console.error('[SyncService] Storage event parse error:', error);
      }
    };

    window.addEventListener('storage', this.storageListenerBound);
  }

  // ==========================================================================
  // PRIVATE - MESSAGE HANDLING
  // ==========================================================================

  private handleMessage(message: SyncMessage): void {
    // Validate message type
    if (message.type !== 'SETTINGS_UPDATE') {
      return;
    }

    // Ignore own messages (prevent loops)
    if (message.origin === this.origin) {
      return;
    }

    // Ignore stale messages (already processed higher version)
    if (message.version <= this.changeVersion) {
      return;
    }

    // Update version (monotonic)
    this.changeVersion = Math.max(this.changeVersion, message.version);

    // Notify all listeners
    this.notifyListeners(message.changes);
  }

  private notifyListeners(changes: Partial<SettingsState>): void {
    this.listeners.forEach(listener => {
      try {
        listener(changes);
      } catch (error) {
        console.error('[SyncService] Listener error:', error);
      }
    });
  }

  // ==========================================================================
  // PRIVATE - UTILITIES
  // ==========================================================================

  // 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
  private generateOrigin(): string {
    // Create unique tab identifier with crypto-secure ID
    return generateTempId();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create sync service instance
 *
 * @param channelName - BroadcastChannel name (default: 'dxf_settings_sync')
 * @returns SyncService instance
 */
export function createSyncService(channelName?: string): SyncService {
  return new SyncService(channelName);
}

/**
 * Check if cross-tab sync is supported
 *
 * @returns True if BroadcastChannel or storage events available
 */
export function isSyncSupported(): boolean {
  return (
    typeof BroadcastChannel !== 'undefined' ||
    (typeof window !== 'undefined' && typeof localStorage !== 'undefined')
  );
}
