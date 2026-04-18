// src/app/api/communications/webhooks/telegram/admin/service.ts

import { ADMIN_CONFIG, isConfigured } from './config';
import { formatAdminMessage } from './format';
import { getAdminKeyboard } from './keyboard';
import { sendMessageToTelegram } from './client';
import type { AdminNotification, UserMessage, Priority } from './types';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('TelegramAdminService');

/**
 * Main function to orchestrate sending a notification to the admin.
 */
export async function sendAdminNotification(notification: AdminNotification): Promise<boolean> {
    if (!isConfigured()) {
        logger.info('Admin notifications disabled or not configured');
        return false;
    }

    try {
        const text = formatAdminMessage(notification);
        const reply_markup = getAdminKeyboard(notification.userInfo);

        const result = await sendMessageToTelegram(ADMIN_CONFIG.adminChatId, text, reply_markup);

        if (result.success) {
            logger.info('Admin notification sent successfully');
        } else {
            logger.error('Failed to send admin notification', { error: result.error });
        }
        
        return result.success;

    } catch (error) {
        logger.error('Error sending admin notification', { error });
        return false;
    }
}

/**
 * Quick notification helpers for common events.
 */

export async function notifyNewMessage(userMessage: UserMessage): Promise<boolean> {
    const notification: AdminNotification = {
        type: 'new_message',
        priority: userMessage.queryType === 'contact' ? 'high' : 'medium',
        message: 'Νέο μήνυμα από πελάτη',
        userInfo: userMessage,
        timestamp: nowISO()
    };
    return sendAdminNotification(notification);
}

export async function notifySecurityAlert(userMessage: UserMessage, reason: string): Promise<boolean> {
    const notification: AdminNotification = {
        type: 'security_alert',
        priority: 'urgent',
        message: `Security Alert: ${reason}`,
        userInfo: userMessage,
        timestamp: nowISO()
    };
    return sendAdminNotification(notification);
}

export async function notifySystemEvent(event: string, priority: Priority = 'medium'): Promise<boolean> {
    const notification: AdminNotification = {
        type: 'system_event',
        priority,
        message: event,
        timestamp: nowISO()
    };
    return sendAdminNotification(notification);
}

/**
 * Sends a daily summary notification to the admin.
 */
export async function sendDailySummary(stats: {
    totalMessages: number;
    uniqueUsers: number;
    propertySearches: number;
    contactRequests: number;
    securityAlerts: number;
}): Promise<boolean> {
    const message = `📊 <b>Ημερήσια Αναφορά Bot</b>

📈 <b>Στατιστικά:</b>
- Συνολικά μηνύματα: ${stats.totalMessages}
- Μοναδικοί χρήστες: ${stats.uniqueUsers}
- Αναζητήσεις ακινήτων: ${stats.propertySearches}
- Αιτήματα επικοινωνίας: ${stats.contactRequests}
- Security alerts: ${stats.securityAlerts}

📅 Ημερομηνία: ${new Date().toLocaleString('el-GR')}`;

    return await sendAdminNotification({
        type: 'system_event',
        priority: 'low',
        message: message,
        timestamp: nowISO()
    });
}

/**
 * Sends a test message to the admin chat to verify configuration.
 */
export async function testAdminNotifications(): Promise<boolean> {
    logger.info('Sending test admin notification');
    const testMessage: UserMessage = {
        userId: process.env.NEXT_PUBLIC_TELEGRAM_TEST_USER_ID || '123456789',
        username: process.env.NEXT_PUBLIC_TELEGRAM_TEST_USERNAME || 'test_user',
        firstName: process.env.NEXT_PUBLIC_TELEGRAM_TEST_FIRST_NAME || 'Test',
        lastName: process.env.NEXT_PUBLIC_TELEGRAM_TEST_LAST_NAME || 'User',
        messageText: 'Αυτό είναι ένα test message! <b>Hello</b>',
        timestamp: nowISO(),
        queryType: 'general',
    };
    return notifyNewMessage(testMessage);
}
