/**
 * 🔐 SESSION SERVICE MODULE
 *
 * Centralized exports for session management
 *
 * @module services/session
 */

// Types
export type {
  DeviceType,
  OperatingSystem,
  BrowserType,
  SessionDeviceInfo,
  SessionLocation,
  SessionStatus,
  LoginMethod,
  SessionMetadata,
  SessionTimestamps,
  UserSession,
  ClientDeviceHints,
  SyncActiveSessionInput,
  SyncActiveSessionResult,
  UpdateSessionInput,
  SessionQueryFilters,
  SessionStatistics,
  SessionDisplayItem,
  EndedSessionDisplayItem,
  SessionsOverviewDisplay,
  SessionActionResult,
  SessionEvent,
  SessionEventType
} from './session.types';

// Service
export {
  EnterpriseSessionService,
  sessionService
} from './EnterpriseSessionService';
