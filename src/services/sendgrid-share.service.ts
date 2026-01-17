// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';

export interface PropertyShareEmail {
  recipientEmail: string;
  recipientName?: string;
  propertyTitle: string;
  propertyDescription?: string;
  propertyPrice?: number;
  propertyArea?: number;
  propertyLocation?: string;
  propertyUrl: string;
  senderName?: string;
  senderEmail?: string;
  personalMessage?: string;
}

export class SendGridShareService {
  static async sendPropertyShare(emailData: PropertyShareEmail): Promise<boolean> {
    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      await apiClient.post('/api/communications/email/property-share', emailData);
      return true;
    } catch (error) {
      console.error('SendGrid share failed:', error);
      return false;
    }
  }
}
