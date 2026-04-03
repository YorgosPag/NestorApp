import { createModuleLogger } from '@/lib/telemetry';
import type { CompanyConfig, InlineKeyboardRows } from './response-types';

const logger = createModuleLogger('TelegramResponses');

const FALLBACK_VALUE = '-';

export const getCompanyConfig = (): CompanyConfig => {
  const config = {
    name: process.env.NEXT_PUBLIC_COMPANY_NAME,
    email: process.env.NEXT_PUBLIC_COMPANY_EMAIL,
    phone: process.env.NEXT_PUBLIC_COMPANY_PHONE,
    hours: process.env.NEXT_PUBLIC_COMPANY_HOURS,
    city: process.env.NEXT_PUBLIC_DEFAULT_CITY,
    website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE,
  };

  const missingKeys = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    logger.warn('Missing company config', { missingKeys: missingKeys.join(', ') });
  }

  return {
    name: config.name || FALLBACK_VALUE,
    email: config.email || FALLBACK_VALUE,
    phone: config.phone || FALLBACK_VALUE,
    hours: config.hours || FALLBACK_VALUE,
    city: config.city || FALLBACK_VALUE,
    website: config.website || FALLBACK_VALUE,
  };
};

export const createInlineKeyboard = (rows: InlineKeyboardRows) => ({
  inline_keyboard: rows,
});
