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
      const response = await fetch('/api/communications/email/property-share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      return response.ok;
    } catch (error) {
      console.error('SendGrid share failed:', error);
      return false;
    }
  }
}
