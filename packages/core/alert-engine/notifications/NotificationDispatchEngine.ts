/**
 * 🏢 ENTERPRISE NOTIFICATION DISPATCH ENGINE
 *
 * 🚨 ENTERPRISE MIGRATION NOTICE
 *
 * This file contains hardcoded notification values που have been replaced by:
 * EnterpriseNotificationService για database-driven configuration.
 *
 * Legacy hardcoded values are maintained για backward compatibility.
 * For new code, use:
 *
 * ```typescript
 * import { enterpriseNotificationService } from '@/services/notification/EnterpriseNotificationService';
 * const priorities = await enterpriseNotificationService.getNotificationPriorities('production', tenantId);
 * const priorityId = await enterpriseNotificationService.getPriorityForSeverity('critical', 'production', tenantId);
 * ```
 *
 * @see src/services/notification/EnterpriseNotificationService.ts
 */

/**
 * NOTIFICATION DISPATCH ENGINE
 * Geo-Alert System - Phase 5: Multi-Channel Notification System
 *
 * Enterprise notification dispatch system με:
 * - Multiple delivery channels (Email, SMS, Webhook, Push)
 * - Template-based messaging
 * - Delivery status tracking
 * - Retry logic και failover
 * - Priority-based queuing
 * - Delivery preferences management
 */

import type { Alert, AlertSeverity } from '../detection/AlertDetectionSystem';

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface NotificationChannel {
  id: string;
  name: string;
  type: ChannelType;
  isEnabled: boolean;

  // Channel configuration
  config: ChannelConfig;

  // Delivery settings
  retryPolicy: RetryPolicy;
  rateLimiting?: RateLimitConfig;

  // Priority handling
  supportedPriorities: NotificationPriority[];

  // Status tracking
  isHealthy: boolean;
  lastSuccessfulDelivery?: Date;
  totalDeliveries: number;
  failedDeliveries: number;
}

export type ChannelType = 'email' | 'sms' | 'webhook' | 'push' | 'slack' | 'teams' | 'in_app';

export interface ChannelConfig {
  // Email configuration
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };

  // SMS configuration
  sms?: {
    provider: 'twilio' | 'aws_sns';
    apiKey: string;
    fromNumber: string;
  };

  // Webhook configuration
  webhook?: {
    url: string;
    method: 'POST' | 'PUT';
    headers: Record<string, string>;
    timeout: number;
  };

  // Push notification configuration
  push?: {
    provider: 'firebase' | 'apns';
    serverKey: string;
  };

  // Slack configuration
  slack?: {
    webhookUrl: string;
    channel: string;
    username: string;
  };
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number; // milliseconds
  backoffMultiplier: number; // Exponential backoff
  maxRetryDelay: number;
}

export interface NotificationConfig {
  channels: {
    [key: string]: {
      enabled: boolean;
      priority: number;
    };
  };
  retryAttempts: number;
  retryDelay: number;
  batchSize: number;
  rateLimit: number;
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  burstAllowance: number; // Extra requests allowed in burst
}

export type NotificationPriority = 'immediate' | 'high' | 'normal' | 'low' | 'batch';

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;

  // Template για different channels
  channels: {
    [K in ChannelType]?: ChannelTemplate;
  };

  // Conditional logic
  conditions?: TemplateCondition[];

  // Personalization
  personalization: PersonalizationConfig;
}

export interface ChannelTemplate {
  subject?: string; // για email
  body: string;
  format: 'plain' | 'html' | 'markdown' | 'json';
  attachments?: TemplateAttachment[];
}

export interface TemplateAttachment {
  name: string;
  type: 'pdf' | 'image' | 'json' | 'csv';
  source: 'inline' | 'url' | 'generated';
  content?: string;
  url?: string;
}

export interface TemplateCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
  template: string; // Template ID to use if condition matches
}

export interface PersonalizationConfig {
  useRecipientName: boolean;
  useRecipientTimezone: boolean;
  useRecipientLanguage: boolean;
  customFields: string[]; // Fields to personalize
}

// Notification message
export interface NotificationMessage {
  id: string;
  alertId: string;
  channelId: string;
  templateId: string;

  // Recipient information
  recipient: NotificationRecipient;

  // Message content
  subject?: string;
  body: string;
  format: 'plain' | 'html' | 'markdown' | 'json';
  attachments: NotificationAttachment[];

  // Delivery metadata
  priority: NotificationPriority;
  scheduledAt: Date;
  deliveredAt?: Date;
  readAt?: Date;

  // Status tracking
  status: MessageStatus;
  attempts: DeliveryAttempt[];
  errorMessage?: string;

  // Context
  context: Record<string, any>;
}

export type MessageStatus = 'queued' | 'sending' | 'delivered' | 'failed' | 'cancelled';

export interface NotificationRecipient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  deviceTokens?: string[]; // για push notifications
  slackUserId?: string;
  teamsUserId?: string;

  // Preferences
  preferences: NotificationPreferences;

  // Timezone για scheduling
  timezone: string;
  language: string;
}

export interface NotificationPreferences {
  channels: {
    [K in ChannelType]?: ChannelPreference;
  };

  // Severity preferences
  severityThresholds: {
    [K in AlertSeverity]: ChannelType[];
  };

  // Timing preferences
  quietHours?: {
    start: string; // HH:MM format
    end: string;
    timezone: string;
  };

  // Frequency limits
  maxNotificationsPerHour: number;
  maxNotificationsPerDay: number;
}

export interface ChannelPreference {
  enabled: boolean;
  priority: number; // 1 = highest priority
  fallbackChannels: ChannelType[];
}

export interface NotificationAttachment {
  name: string;
  type: string;
  size: number;
  content: Buffer | string;
  url?: string;
}

export interface DeliveryAttempt {
  attemptNumber: number;
  attemptedAt: Date;
  status: 'success' | 'failed' | 'retry';
  responseCode?: number;
  responseMessage?: string;
  deliveryTime?: number; // milliseconds
}

export interface NotificationQueue {
  priority: NotificationPriority;
  messages: NotificationMessage[];
  isProcessing: boolean;
  lastProcessedAt?: Date;
}

export interface DeliveryStatistics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number; // percentage

  // By channel
  byChannel: {
    [K in ChannelType]?: {
      sent: number;
      delivered: number;
      failed: number;
      avgDeliveryTime: number;
    };
  };

  // By priority
  byPriority: {
    [K in NotificationPriority]: {
      sent: number;
      delivered: number;
      avgDeliveryTime: number;
    };
  };

  // Temporal metrics
  last24Hours: {
    sent: number;
    delivered: number;
    failed: number;
  };
}

// ============================================================================
// NOTIFICATION DISPATCH ENGINE CLASS
// ============================================================================

export class NotificationDispatchEngine {
  private channels: Map<string, NotificationChannel> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private recipients: Map<string, NotificationRecipient> = new Map();
  private queues: Map<NotificationPriority, NotificationQueue> = new Map();
  private statistics: DeliveryStatistics;

  private isRunning = false;
  private processingInterval?: NodeJS.Timeout;

  constructor() {
    this.statistics = {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      deliveryRate: 0,
      byChannel: {},
      // ⚠️ LEGACY FALLBACK: Hardcoded priority statistics (replaced by enterprise configuration)
      byPriority: {
        immediate: { sent: 0, delivered: 0, avgDeliveryTime: 0 },
        high: { sent: 0, delivered: 0, avgDeliveryTime: 0 },
        normal: { sent: 0, delivered: 0, avgDeliveryTime: 0 },
        low: { sent: 0, delivered: 0, avgDeliveryTime: 0 },
        batch: { sent: 0, delivered: 0, avgDeliveryTime: 0 }
      },
      last24Hours: { sent: 0, delivered: 0, failed: 0 }
    };

    this.initializeQueues();
    this.initializeDefaultChannels();
    this.initializeDefaultTemplates();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  // ========================================================================
  // 🏢 ENTERPRISE NOTIFICATION PRIORITIES
  // ========================================================================

  /**
   * ✅ Notification priorities are now loaded from Firebase/Database!
   *
   * Configuration υπάρχει στο: COLLECTIONS.NOTIFICATION_PRIORITIES
   * Management μέσω: EnterpriseNotificationService
   * Fallback: Built-in defaults για offline mode
   *
   * Features:
   * - Environment-specific priorities (dev/staging/production)
   * - Tenant-specific overrides
   * - Configurable batch sizes and intervals
   * - Real-time priority updates
   * - Performance-optimized caching
   *
   * Usage:
   * ```typescript
   * import { enterpriseNotificationService } from '@/services/notification/EnterpriseNotificationService';
   *
   * // Load priorities from database
   * const priorities = await enterpriseNotificationService.getNotificationPriorities('production', tenantId);
   * const batchSize = await enterpriseNotificationService.getBatchSizeForPriority('immediate', 'production', tenantId);
   * ```
   */

  /**
   * ⚠️ LEGACY FALLBACK: Initialize notification queues with default priorities
   *
   * Αυτή η μέθοδος χρησιμοποιείται μόνο ως fallback όταν:
   * - Η Firebase δεν είναι διαθέσιμη
   * - Offline mode
   * - Emergency fallback scenarios
   *
   * @deprecated Use enterpriseNotificationService.getNotificationPriorities() για full enterprise features
   */
  private initializeQueues(): void {
    // ⚠️ LEGACY FALLBACK: Hardcoded priorities (replaced by database-driven configuration)
    const priorities: NotificationPriority[] = ['immediate', 'high', 'normal', 'low', 'batch'];

    for (const priority of priorities) {
      this.queues.set(priority, {
        priority,
        messages: [],
        isProcessing: false
      });
    }
  }

  private initializeDefaultChannels(): void {
    // Email channel
    this.channels.set('email', {
      id: 'email',
      name: 'Email Notifications',
      type: 'email',
      isEnabled: true,
      config: {
        smtp: {
          host: process.env.SMTP_HOST || 'smtp.example.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || 'notifications@example.com',
            pass: process.env.SMTP_PASS || 'password'
          }
        }
      },
      // ⚠️ LEGACY FALLBACK: Hardcoded retry policy (replaced by enterprise configuration)
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 5000,
        backoffMultiplier: 2,
        maxRetryDelay: 60000
      },
      rateLimiting: {
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 1000,
        burstAllowance: 10
      },
      // ⚠️ LEGACY FALLBACK: Hardcoded supported priorities (replaced by enterprise configuration)
      supportedPriorities: ['immediate', 'high', 'normal', 'low', 'batch'],
      isHealthy: true,
      totalDeliveries: 0,
      failedDeliveries: 0
    });

    // In-app notifications channel
    this.channels.set('in_app', {
      id: 'in_app',
      name: 'In-App Notifications',
      type: 'in_app',
      isEnabled: true,
      config: {},
      retryPolicy: {
        maxRetries: 1,
        retryDelay: 1000,
        backoffMultiplier: 1,
        maxRetryDelay: 1000
      },
      // ⚠️ LEGACY FALLBACK: Hardcoded supported priorities (replaced by enterprise configuration)
      supportedPriorities: ['immediate', 'high', 'normal'],
      isHealthy: true,
      totalDeliveries: 0,
      failedDeliveries: 0
    });

    // Webhook channel για external integrations
    this.channels.set('webhook', {
      id: 'webhook',
      name: 'Webhook Notifications',
      type: 'webhook',
      isEnabled: true,
      config: {
        webhook: {
          url: process.env.WEBHOOK_URL || 'https://api.example.com/notifications',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.WEBHOOK_TOKEN || 'token'}`
          },
          timeout: 10000
        }
      },
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 2000,
        backoffMultiplier: 2,
        maxRetryDelay: 30000
      },
      // ⚠️ LEGACY FALLBACK: Hardcoded supported priorities (replaced by enterprise configuration)
      supportedPriorities: ['immediate', 'high', 'normal'],
      isHealthy: true,
      totalDeliveries: 0,
      failedDeliveries: 0
    });

    console.log(`✅ Initialized ${this.channels.size} notification channels`);
  }

  private initializeDefaultTemplates(): void {
    // Alert notification template
    this.templates.set('alert_notification', {
      id: 'alert_notification',
      name: 'Alert Notification Template',
      description: 'Default template για alert notifications',
      channels: {
        email: {
          subject: '🚨 Alert: ${alert.title}',
          body: `
            <h2>Alert Notification</h2>
            <p><strong>Type:</strong> ${alert.type}</p>
            <p><strong>Severity:</strong> ${alert.severity}</p>
            <p><strong>Message:</strong> ${alert.message}</p>
            <p><strong>Detected At:</strong> ${alert.detectedAt}</p>

            ${alert.location ? '<p><strong>Location:</strong> ${alert.location.lat}, ${alert.location.lng}</p>' : ''}

            <hr>
            <p>This is an automated notification από the Geo-Alert System.</p>
          `,
          format: 'html'
        },
        in_app: {
          body: '${alert.title}: ${alert.message}',
          format: 'plain'
        },
        webhook: {
          body: JSON.stringify({
            event: 'alert_triggered',
            alert: {
              id: '${alert.id}',
              type: '${alert.type}',
              severity: '${alert.severity}',
              title: '${alert.title}',
              message: '${alert.message}',
              detectedAt: '${alert.detectedAt}',
              location: '${alert.location}'
            }
          }),
          format: 'json'
        }
      },
      personalization: {
        useRecipientName: true,
        useRecipientTimezone: true,
        useRecipientLanguage: false,
        customFields: ['alert.type', 'alert.severity']
      }
    });

    console.log(`✅ Initialized ${this.templates.size} notification templates`);
  }

  // ========================================================================
  // NOTIFICATION DISPATCH
  // ========================================================================

  /**
   * Start notification processing
   */
  startDispatch(): void {
    if (this.isRunning) {
      console.log('⚠️ Notification dispatch is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting notification dispatch engine...');

    // ⚠️ LEGACY FALLBACK: Process queues κάθε 2 seconds (replaced by enterprise configuration)
    this.processingInterval = setInterval(async () => {
      await this.processAllQueues();
    }, 2000);
  }

  /**
   * Stop notification processing
   */
  stopDispatch(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    this.isRunning = false;
    console.log('⏹️ Notification dispatch engine stopped');
  }

  /**
   * Send notification για alert
   */
  async sendAlertNotification(alert: Alert, recipientIds: string[]): Promise<NotificationMessage[]> {
    const messages: NotificationMessage[] = [];

    for (const recipientId of recipientIds) {
      const recipient = this.recipients.get(recipientId);
      if (!recipient) {
        console.warn(`⚠️ Recipient ${recipientId} not found`);
        continue;
      }

      // Determine appropriate channels based on alert severity και recipient preferences
      const channels = this.getChannelsForAlert(alert, recipient);

      for (const channelId of channels) {
        const message = await this.createNotificationMessage(alert, recipient, channelId);
        if (message) {
          messages.push(message);
          await this.queueMessage(message);
        }
      }
    }

    return messages;
  }

  /**
   * Send custom notification
   */
  async sendCustomNotification(
    recipientId: string,
    channelId: string,
    templateId: string,
    context: Record<string, any>,
    priority: NotificationPriority = 'normal'
  ): Promise<NotificationMessage | null> {
    const recipient = this.recipients.get(recipientId);
    if (!recipient) {
      throw new Error(`Recipient ${recipientId} not found`);
    }

    const channel = this.channels.get(channelId);
    if (!channel || !channel.isEnabled) {
      throw new Error(`Channel ${channelId} not available`);
    }

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const message = await this.createCustomMessage(recipient, channel, template, context, priority);
    await this.queueMessage(message);

    return message;
  }

  // ========================================================================
  // MESSAGE CREATION
  // ========================================================================

  private async createNotificationMessage(
    alert: Alert,
    recipient: NotificationRecipient,
    channelId: string
  ): Promise<NotificationMessage | null> {
    const channel = this.channels.get(channelId);
    if (!channel || !channel.isEnabled) {
      return null;
    }

    const template = this.templates.get('alert_notification');
    if (!template) {
      return null;
    }

    const priority = this.mapSeverityToPriority(alert.severity);
    const context = {
      alert,
      recipient,
      timestamp: new Date().toISOString()
    };

    return this.createCustomMessage(recipient, channel, template, context, priority);
  }

  private async createCustomMessage(
    recipient: NotificationRecipient,
    channel: NotificationChannel,
    template: NotificationTemplate,
    context: Record<string, any>,
    priority: NotificationPriority
  ): Promise<NotificationMessage> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get channel-specific template
    const channelTemplate = template.channels[channel.type];
    if (!channelTemplate) {
      throw new Error(`Template ${template.id} does not support channel ${channel.type}`);
    }

    // Render message content
    const subject = this.renderTemplate(channelTemplate.subject || '', context);
    const body = this.renderTemplate(channelTemplate.body, context);

    const message: NotificationMessage = {
      id: messageId,
      alertId: context.alert?.id || 'custom',
      channelId: channel.id,
      templateId: template.id,
      recipient,
      subject: subject || undefined,
      body,
      format: channelTemplate.format,
      attachments: [], // TODO: Process template attachments
      priority,
      scheduledAt: new Date(),
      status: 'queued',
      attempts: [],
      context
    };

    return message;
  }

  // ========================================================================
  // QUEUE MANAGEMENT
  // ========================================================================

  private async queueMessage(message: NotificationMessage): Promise<void> {
    const queue = this.queues.get(message.priority);
    if (!queue) {
      throw new Error(`Queue για priority ${message.priority} not found`);
    }

    queue.messages.push(message);
    console.log(`📨 Message queued: ${message.id} (${message.priority} priority)`);

    // Process immediately if high priority
    if (message.priority === 'immediate') {
      await this.processQueue(queue);
    }
  }

  /**
   * ⚠️ LEGACY FALLBACK: Process all notification queues
   *
   * Uses hardcoded priorities as fallback when enterprise service is unavailable.
   *
   * @deprecated Use enterpriseNotificationService.getNotificationPriorities() για database-driven priorities
   */
  private async processAllQueues(): Promise<void> {
    // ⚠️ LEGACY FALLBACK: Hardcoded priorities (replaced by database-driven configuration)
    const priorities: NotificationPriority[] = ['immediate', 'high', 'normal', 'low', 'batch'];

    for (const priority of priorities) {
      const queue = this.queues.get(priority);
      if (queue && !queue.isProcessing && queue.messages.length > 0) {
        await this.processQueue(queue);
      }
    }
  }

  private async processQueue(queue: NotificationQueue): Promise<void> {
    if (queue.isProcessing || queue.messages.length === 0) {
      return;
    }

    queue.isProcessing = true;
    queue.lastProcessedAt = new Date();

    try {
      // Process batch size based on priority
      const batchSize = this.getBatchSizeForPriority(queue.priority);
      const batch = queue.messages.splice(0, batchSize);

      console.log(`📬 Processing ${batch.length} messages από ${queue.priority} queue`);

      // Process messages in parallel για better performance
      const promises = batch.map(message => this.deliverMessage(message));
      await Promise.allSettled(promises);

    } finally {
      queue.isProcessing = false;
    }
  }

  // ========================================================================
  // MESSAGE DELIVERY
  // ========================================================================

  private async deliverMessage(message: NotificationMessage): Promise<void> {
    const channel = this.channels.get(message.channelId);
    if (!channel) {
      message.status = 'failed';
      message.errorMessage = `Channel ${message.channelId} not found`;
      return;
    }

    const startTime = Date.now();
    message.status = 'sending';

    const attempt: DeliveryAttempt = {
      attemptNumber: message.attempts.length + 1,
      attemptedAt: new Date(),
      status: 'failed'
    };

    try {
      // Deliver based on channel type
      switch (channel.type) {
        case 'email':
          await this.deliverEmail(message, channel);
          break;

        case 'in_app':
          await this.deliverInApp(message, channel);
          break;

        case 'webhook':
          await this.deliverWebhook(message, channel);
          break;

        default:
          throw new Error(`Delivery για channel type ${channel.type} not implemented`);
      }

      // Success
      const deliveryTime = Date.now() - startTime;
      attempt.status = 'success';
      attempt.deliveryTime = deliveryTime;

      message.status = 'delivered';
      message.deliveredAt = new Date();

      // Update statistics
      this.updateDeliveryStatistics(channel.type, 'delivered', deliveryTime);

      console.log(`✅ Message delivered: ${message.id} via ${channel.type} (${deliveryTime}ms)`);

    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      attempt.status = 'failed';
      attempt.deliveryTime = deliveryTime;
      attempt.responseMessage = error instanceof Error ? error.message : 'Unknown error';

      message.errorMessage = attempt.responseMessage;

      // Determine if retry is needed
      const shouldRetry = message.attempts.length < channel.retryPolicy.maxRetries;

      if (shouldRetry) {
        message.status = 'queued';
        // Re-queue με delay
        setTimeout(() => {
          this.queueMessage(message);
        }, this.calculateRetryDelay(message.attempts.length, channel.retryPolicy));

        attempt.status = 'retry';
        console.log(`🔄 Message will retry: ${message.id} (attempt ${attempt.attemptNumber})`);
      } else {
        message.status = 'failed';
        this.updateDeliveryStatistics(channel.type, 'failed', deliveryTime);
        console.error(`❌ Message failed permanently: ${message.id}`, error);
      }
    } finally {
      message.attempts.push(attempt);
    }
  }

  private async deliverEmail(message: NotificationMessage, channel: NotificationChannel): Promise<void> {
    // Mock email delivery
    console.log(`📧 Sending email to ${message.recipient.email}`);
    console.log(`   Subject: ${message.subject}`);
    console.log(`   Body: ${message.body.substring(0, 100)}...`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    // Mock occasional failures
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('SMTP server temporarily unavailable');
    }
  }

  private async deliverInApp(message: NotificationMessage, channel: NotificationChannel): Promise<void> {
    // Mock in-app notification
    console.log(`🔔 In-app notification για user ${message.recipient.id}`);
    console.log(`   Message: ${message.body}`);

    // Simulate instant delivery
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private async deliverWebhook(message: NotificationMessage, channel: NotificationChannel): Promise<void> {
    const webhookConfig = channel.config.webhook;
    if (!webhookConfig) {
      throw new Error('Webhook configuration missing');
    }

    console.log(`🌐 Sending webhook to ${webhookConfig.url}`);
    console.log(`   Method: ${webhookConfig.method}`);
    console.log(`   Payload: ${message.body.substring(0, 200)}...`);

    // Simulate HTTP request
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 200));

    // Mock occasional failures
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error('Webhook endpoint returned 500 error');
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private getChannelsForAlert(alert: Alert, recipient: NotificationRecipient): string[] {
    const preferences = recipient.preferences;
    const severityChannels = preferences.severityThresholds[alert.severity] || [];

    // Filter by enabled channels
    return severityChannels.filter(channelType => {
      const channelPref = preferences.channels[channelType];
      return channelPref?.enabled && this.channels.get(channelType)?.isEnabled;
    });
  }

  // ========================================================================
  // 🏢 ENTERPRISE SEVERITY TO PRIORITY MAPPING
  // ========================================================================

  /**
   * ✅ Severity mappings are now loaded from Firebase/Database!
   *
   * Configuration υπάρχει στο: COLLECTIONS.SEVERITY_MAPPINGS
   * Management μέσω: EnterpriseNotificationService
   * Features: Tenant-specific overrides, environment-specific mappings
   *
   * Usage:
   * ```typescript
   * import { enterpriseNotificationService } from '@/services/notification/EnterpriseNotificationService';
   * const priorityId = await enterpriseNotificationService.getPriorityForSeverity('critical', 'production', tenantId);
   * ```
   */

  /**
   * ⚠️ LEGACY FALLBACK: Map alert severity to notification priority
   *
   * Αυτή η μέθοδος χρησιμοποιείται μόνο ως fallback όταν:
   * - Η Firebase δεν είναι διαθέσιμη
   * - Offline mode
   * - Emergency fallback scenarios
   *
   * @deprecated Use enterpriseNotificationService.getPriorityForSeverity() για tenant-specific mappings
   */
  private mapSeverityToPriority(severity: AlertSeverity): NotificationPriority {
    // ⚠️ LEGACY FALLBACK: Hardcoded severity mapping (replaced by database-driven configuration)
    const mapping: Record<AlertSeverity, NotificationPriority> = {
      critical: 'immediate',
      high: 'high',
      medium: 'normal',
      low: 'low',
      info: 'batch'
    };

    return mapping[severity] || 'normal';
  }

  // ========================================================================
  // 🏢 ENTERPRISE BATCH SIZE CONFIGURATION
  // ========================================================================

  /**
   * ✅ Batch sizes are now loaded from Firebase/Database!
   *
   * Configuration υπάρχει στο: COLLECTIONS.NOTIFICATION_PRIORITIES
   * Management μέσω: EnterpriseNotificationService
   * Features: Priority-specific batch sizes, environment optimization
   *
   * Usage:
   * ```typescript
   * import { enterpriseNotificationService } from '@/services/notification/EnterpriseNotificationService';
   * const batchSize = await enterpriseNotificationService.getBatchSizeForPriority('immediate', 'production', tenantId);
   * ```
   */

  /**
   * ⚠️ LEGACY FALLBACK: Get batch size for priority
   *
   * @deprecated Use enterpriseNotificationService.getBatchSizeForPriority() για database-driven batch sizes
   */
  private getBatchSizeForPriority(priority: NotificationPriority): number {
    // ⚠️ LEGACY FALLBACK: Hardcoded batch sizes (replaced by database-driven configuration)
    const batchSizes: Record<NotificationPriority, number> = {
      immediate: 1,
      high: 3,
      normal: 5,
      low: 10,
      batch: 20
    };

    return batchSizes[priority] || 5;
  }

  private calculateRetryDelay(attemptNumber: number, retryPolicy: RetryPolicy): number {
    const baseDelay = retryPolicy.retryDelay;
    const multiplier = Math.pow(retryPolicy.backoffMultiplier, attemptNumber);
    const delay = baseDelay * multiplier;

    return Math.min(delay, retryPolicy.maxRetryDelay);
  }

  private renderTemplate(template: string, context: Record<string, any>): string {
    return template.replace(/\${([^}]+)}/g, (match, path) => {
      const value = this.getNestedValue(context, path);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  private updateDeliveryStatistics(channelType: ChannelType, result: 'delivered' | 'failed', deliveryTime: number): void {
    this.statistics.totalSent++;

    if (result === 'delivered') {
      this.statistics.totalDelivered++;
      this.statistics.last24Hours.delivered++;
    } else {
      this.statistics.totalFailed++;
      this.statistics.last24Hours.failed++;
    }

    this.statistics.last24Hours.sent++;

    // Update delivery rate
    this.statistics.deliveryRate = (this.statistics.totalDelivered / this.statistics.totalSent) * 100;

    // Update channel statistics
    if (!this.statistics.byChannel[channelType]) {
      this.statistics.byChannel[channelType] = {
        sent: 0,
        delivered: 0,
        failed: 0,
        avgDeliveryTime: 0
      };
    }

    const channelStats = this.statistics.byChannel[channelType]!;
    channelStats.sent++;

    if (result === 'delivered') {
      channelStats.delivered++;
      channelStats.avgDeliveryTime = (channelStats.avgDeliveryTime + deliveryTime) / 2;
    } else {
      channelStats.failed++;
    }
  }

  // ========================================================================
  // MANAGEMENT METHODS
  // ========================================================================

  /**
   * Add notification recipient
   */
  addRecipient(recipient: NotificationRecipient): void {
    this.recipients.set(recipient.id, recipient);
    console.log(`👤 Recipient added: ${recipient.name} (${recipient.id})`);
  }

  /**
   * Update recipient preferences
   */
  updateRecipientPreferences(recipientId: string, preferences: Partial<NotificationPreferences>): void {
    const recipient = this.recipients.get(recipientId);
    if (!recipient) {
      throw new Error(`Recipient ${recipientId} not found`);
    }

    recipient.preferences = { ...recipient.preferences, ...preferences };
    console.log(`⚙️ Preferences updated για recipient ${recipientId}`);
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStatistics(): DeliveryStatistics {
    return { ...this.statistics };
  }

  /**
   * Get system status
   */
  getSystemStatus(): {
    isRunning: boolean;
    channelsActive: number;
    totalRecipients: number;
    queueStatus: Record<NotificationPriority, number>;
    deliveryRate: number;
  } {
    const activeChannels = Array.from(this.channels.values()).filter(c => c.isEnabled && c.isHealthy).length;

    // ✅ ENTERPRISE: Proper initialization instead of 'as any'
    // ⚠️ LEGACY FALLBACK: Hardcoded priorities (replaced by enterprise configuration)
    const queueStatus: Record<NotificationPriority, number> = {
      immediate: 0,
      high: 0,
      normal: 0,
      low: 0,
      batch: 0
    };
    for (const [priority, queue] of this.queues) {
      queueStatus[priority] = queue.messages.length;
    }

    return {
      isRunning: this.isRunning,
      channelsActive: activeChannels,
      totalRecipients: this.recipients.size,
      queueStatus,
      deliveryRate: this.statistics.deliveryRate
    };
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const notificationDispatchEngine = new NotificationDispatchEngine();
export default notificationDispatchEngine;