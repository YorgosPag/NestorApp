// src/app/api/communications/webhooks/telegram/admin/format.ts

import type { AdminNotification, Priority, NotificationType, QueryType } from './types';

/**
 * Escapes special HTML characters to prevent injection.
 */
export function escapeHtml(text: string | undefined | null): string {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getPriorityEmoji(priority: Priority): string {
    switch (priority) {
        case 'urgent': return '🚨';
        case 'high': return '🔴';
        case 'medium': return '🟡';
        case 'low': return '🟢';
        default: return 'ℹ️';
    }
}

function getTypeEmoji(type: NotificationType): string {
    switch (type) {
        case 'new_message': return '💬';
        case 'security_alert': return '🛡️';
        case 'system_event': return '⚙️';
        default: return '📢';
    }
}

function getQueryTypeLabel(type: QueryType): string {
    const labels: Record<QueryType, string> = {
        'property_search': 'Αναζήτηση Ακινήτων',
        'contact': 'Αίτημα Επικοινωνίας',
        'general': 'Γενική Ερώτηση',
        'security_alert': 'Security Alert'
    };
    return labels[type] || 'Άγνωστο';
}

export function translateCriteria(key: string): string {
    const translations: Record<string, string> = {
        type: 'Τύπος',
        maxPrice: 'Μέγιστη Τιμή',
        minPrice: 'Ελάχιστη Τιμή',
        minArea: 'Ελάχιστο Εμβαδόν',
        maxArea: 'Μέγιστο Εμβαδόν',
        rooms: 'Δωμάτια',
        floor: 'Όροφος',
        status: 'Κατάσταση',
        location: 'Περιοχή',
        building: 'Κτίριο',
        project: 'Έργο'
    };
    return translations[key] || key;
}

function formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleString('el-GR', {
        timeZone: 'Europe/Athens',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formats the entire notification message for Telegram with HTML parsing.
 */
export function formatAdminMessage(notification: AdminNotification): string {
    const priorityEmoji = getPriorityEmoji(notification.priority);
    const typeEmoji = getTypeEmoji(notification.type);
    let message = `${priorityEmoji} ${typeEmoji} <b>ADMIN ALERT</b>\n\n`;

    switch (notification.type) {
        case 'new_message':
            if (notification.userInfo) {
                const user = notification.userInfo;
                message += `👤 <b>Νέο μήνυμα από:</b>\n`;
                message += `• Όνομα: ${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}\n`;
                if (user.username) message += `• Username: @${escapeHtml(user.username)}\n`;
                message += `• ID: ${escapeHtml(user.userId)}\n\n`;
                message += `💬 <b>Μήνυμα:</b>\n"${escapeHtml(user.messageText)}"\n\n`;
                message += `🔍 <b>Τύπος ερώτησης:</b> ${getQueryTypeLabel(user.queryType)}\n`;
                if (user.searchCriteria && Object.keys(user.searchCriteria).length > 0) {
                    message += `📋 <b>Κριτήρια αναζήτησης:</b>\n`;
                    Object.entries(user.searchCriteria).forEach(([key, value]) => {
                        if (value) message += `• ${translateCriteria(key)}: ${escapeHtml(String(value))}\n`;
                    });
                }
                message += `⏰ <b>Ώρα:</b> ${formatTime(user.timestamp)}`;
            }
            break;

        case 'security_alert':
            message += `🚨 <b>Security Alert</b>\n\n`;
            message += `⚠️ ${escapeHtml(notification.message)}\n\n`;
            if (notification.userInfo) {
                message += `👤 User: @${escapeHtml(notification.userInfo.username) || escapeHtml(notification.userInfo.firstName)}\n`;
                message += `💬 Query: "${escapeHtml(notification.userInfo.messageText)}"\n`;
            }
            message += `⏰ Time: ${formatTime(notification.timestamp)}`;
            break;

        case 'system_event':
            message += `⚙️ <b>System Event</b>\n\n`;
            message += `📝 ${escapeHtml(notification.message)}\n`;
            message += `⏰ Time: ${formatTime(notification.timestamp)}`;
            break;
    }
    return message;
}
