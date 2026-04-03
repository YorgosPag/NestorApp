/**
 * =============================================================================
 * TELEGRAM MEDIA DOWNLOAD SERVICE (ADR-055)
 * =============================================================================
 *
 * Downloads media files from Telegram servers and uploads to Firebase Storage.
 * Converts Telegram media into canonical MessageAttachment format.
 */

export { getTelegramFile, downloadTelegramFile } from './media-download-telegram-api';
export { extractMediaFromMessage, hasMedia } from './media-download-extractor';
export { processTelegramMedia } from './media-download-processor';
export type {
  MediaDownloadResult,
  ServerFileRecordResult,
  TelegramMediaInfo,
  TenantResolutionResult,
} from './media-download-types';
