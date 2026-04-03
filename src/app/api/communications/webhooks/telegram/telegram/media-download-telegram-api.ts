import type { TelegramFile } from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TelegramMediaApi');

export async function getTelegramFile(fileId: string): Promise<TelegramFile | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.error('TELEGRAM_BOT_TOKEN not configured');
    return null;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const result: { ok?: boolean; result?: TelegramFile; description?: string } = await response.json();

    if (!result.ok || !result.result) {
      logger.error('Telegram getFile failed', { description: result.description });
      return null;
    }

    return result.result;
  } catch (error) {
    logger.error('Error calling Telegram getFile', { error });
    return null;
  }
}

export async function downloadTelegramFile(filePath: string): Promise<Buffer | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.error('TELEGRAM_BOT_TOKEN not configured');
    return null;
  }

  try {
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    logger.info('Downloading from Telegram', { filePath });

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      logger.error('Download failed', { status: response.status, statusText: response.statusText });
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.error('Error downloading Telegram file', { error });
    return null;
  }
}
