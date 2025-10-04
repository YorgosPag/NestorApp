'use client';

// Email Integration Service
export interface EmailProvider {
  type: 'smtp' | 'outlook' | 'gmail' | 'sendgrid' | 'ses';
  config: Record<string, any>;
  isActive: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  category?: string;
}

export interface EmailMessage {
  id: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  attachments?: EmailAttachment[];
  templateId?: string;
  templateVariables?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
  scheduledAt?: Date;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
  size: number;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerId?: string;
}

export interface EmailStats {
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
}

class EmailIntegrationService {
  private static instance: EmailIntegrationService;
  private providers = new Map<string, EmailProvider>();
  private templates = new Map<string, EmailTemplate>();
  private messageQueue: EmailMessage[] = [];
  private isProcessing = false;

  static getInstance(): EmailIntegrationService {
    if (!EmailIntegrationService.instance) {
      EmailIntegrationService.instance = new EmailIntegrationService();
    }
    return EmailIntegrationService.instance;
  }

  // Provider management
  addProvider(id: string, provider: EmailProvider): void {
    this.providers.set(id, provider);
  }

  getProvider(id: string): EmailProvider | undefined {
    return this.providers.get(id);
  }

  getActiveProvider(): EmailProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.isActive) return provider;
    }
    return undefined;
  }

  // Template management
  addTemplate(template: EmailTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): EmailTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): EmailTemplate[] {
    return Array.from(this.templates.values());
  }

  // Email sending
  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const provider = this.getActiveProvider();
    if (!provider) {
      return { success: false, error: 'No active email provider configured' };
    }

    try {
      // Process template if specified
      if (message.templateId) {
        const processedMessage = await this.processTemplate(message);
        if (!processedMessage.success) {
          return { success: false, error: processedMessage.error };
        }
        message = processedMessage.message!;
      }

      // Validate message
      const validation = this.validateMessage(message);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // Send based on provider type
      switch (provider.type) {
        case 'smtp':
          return this.sendViaSMTP(message, provider);
        case 'sendgrid':
          return this.sendViaSendGrid(message, provider);
        case 'gmail':
          return this.sendViaGmail(message, provider);
        case 'outlook':
          return this.sendViaOutlook(message, provider);
        default:
          return { success: false, error: `Unsupported provider: ${provider.type}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Bulk email sending
  async sendBulkEmails(
    messages: EmailMessage[],
    onProgress?: (sent: number, total: number) => void
  ): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const result = await this.sendEmail(messages[i]);
      results.push(result);
      
      onProgress?.(i + 1, messages.length);
      
      // Add delay to avoid rate limits
      await this.delay(100);
    }
    
    return results;
  }

  // Template processing
  private async processTemplate(message: EmailMessage): Promise<{
    success: boolean;
    message?: EmailMessage;
    error?: string;
  }> {
    const template = this.getTemplate(message.templateId!);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    try {
      const variables = message.templateVariables || {};
      
      // Process subject
      let subject = template.subject;
      for (const [key, value] of Object.entries(variables)) {
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }

      // Process HTML content
      let htmlContent = template.htmlContent;
      for (const [key, value] of Object.entries(variables)) {
        htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }

      // Process text content
      let textContent = template.textContent || '';
      for (const [key, value] of Object.entries(variables)) {
        textContent = textContent.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }

      return {
        success: true,
        message: {
          ...message,
          subject,
          htmlContent,
          textContent: textContent || undefined
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Template processing failed'
      };
    }
  }

  // Provider implementations
  private async sendViaSMTP(message: EmailMessage, provider: EmailProvider): Promise<EmailSendResult> {
    // Mock SMTP implementation
    console.log('Sending email via SMTP:', { 
      to: message.to, 
      subject: message.subject,
      provider: provider.config 
    });
    
    // Simulate network delay
    await this.delay(Math.random() * 1000 + 500);
    
    return { 
      success: true, 
      messageId: `smtp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      providerId: 'smtp'
    };
  }

  private async sendViaSendGrid(message: EmailMessage, provider: EmailProvider): Promise<EmailSendResult> {
    // Mock SendGrid implementation
    console.log('Sending email via SendGrid:', { 
      to: message.to, 
      subject: message.subject 
    });
    
    await this.delay(Math.random() * 800 + 300);
    
    return { 
      success: true, 
      messageId: `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      providerId: 'sendgrid'
    };
  }

  private async sendViaGmail(message: EmailMessage, provider: EmailProvider): Promise<EmailSendResult> {
    // Mock Gmail API implementation
    console.log('Sending email via Gmail API:', { 
      to: message.to, 
      subject: message.subject 
    });
    
    await this.delay(Math.random() * 600 + 400);
    
    return { 
      success: true, 
      messageId: `gmail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      providerId: 'gmail'
    };
  }

  private async sendViaOutlook(message: EmailMessage, provider: EmailProvider): Promise<EmailSendResult> {
    // Mock Outlook API implementation
    console.log('Sending email via Outlook API:', { 
      to: message.to, 
      subject: message.subject 
    });
    
    await this.delay(Math.random() * 700 + 300);
    
    return { 
      success: true, 
      messageId: `outlook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      providerId: 'outlook'
    };
  }

  // Message validation
  private validateMessage(message: EmailMessage): { isValid: boolean; error?: string } {
    if (!message.to || message.to.length === 0) {
      return { isValid: false, error: 'Recipients are required' };
    }

    if (!message.subject || message.subject.trim() === '') {
      return { isValid: false, error: 'Subject is required' };
    }

    if (!message.htmlContent && !message.textContent) {
      return { isValid: false, error: 'Email content is required' };
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allRecipients = [...message.to, ...(message.cc || []), ...(message.bcc || [])];
    
    for (const email of allRecipients) {
      if (!emailRegex.test(email)) {
        return { isValid: false, error: `Invalid email address: ${email}` };
      }
    }

    return { isValid: true };
  }

  // Queue management
  queueEmail(message: EmailMessage): void {
    this.messageQueue.push({
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      
      try {
        await this.sendEmail(message);
      } catch (error) {
        console.error('Failed to send queued email:', error);
      }
      
      // Small delay between queue processing
      await this.delay(50);
    }
    
    this.isProcessing = false;
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }

  clearQueue(): void {
    this.messageQueue = [];
  }

  // Utility methods
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Email analytics (mock)
  async getEmailStats(dateRange?: { from: Date; to: Date }): Promise<EmailStats> {
    // Mock implementation
    return {
      sent: Math.floor(Math.random() * 1000) + 100,
      delivered: Math.floor(Math.random() * 900) + 80,
      bounced: Math.floor(Math.random() * 50) + 5,
      opened: Math.floor(Math.random() * 600) + 50,
      clicked: Math.floor(Math.random() * 200) + 20,
      unsubscribed: Math.floor(Math.random() * 10) + 1
    };
  }

  // Template helpers
  createTemplate(
    name: string,
    subject: string,
    htmlContent: string,
    textContent?: string,
    category?: string
  ): EmailTemplate {
    const variables = this.extractVariables(htmlContent + ' ' + (textContent || ''));
    
    const template: EmailTemplate = {
      id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      subject,
      htmlContent,
      textContent,
      variables,
      category
    };
    
    this.addTemplate(template);
    return template;
  }

  private extractVariables(content: string): string[] {
    const matches = content.match(/{{(\w+)}}/g) || [];
    const variables = matches.map(match => match.replace(/[{}]/g, ''));
    return [...new Set(variables)]; // Remove duplicates
  }
}

export default EmailIntegrationService;