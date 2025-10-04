export type EmailTemplateType = 'residential' | 'commercial' | 'premium' | 'default';

export interface EmailTemplate {
  id: EmailTemplateType;
  name: string;
  description: string;
  icon: string;
  preview?: string;
  htmlTemplate: (data: EmailTemplateData) => string;
}

export interface EmailTemplateData {
  propertyTitle: string;
  propertyDescription?: string;
  propertyPrice?: number;
  propertyArea?: number;
  propertyLocation?: string;
  propertyUrl: string;
  recipientEmail: string;
  personalMessage?: string;
  senderName?: string;
}
