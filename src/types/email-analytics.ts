export interface EmailAnalyticsEvent {
  id?: string;
  eventType: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'dropped';
  recipientEmail: string;
  propertyId?: string;
  timestamp: Date;
  sendgridEventId: string;
  sendgridMessageId: string;
  metadata: {
    ip?: string;
    userAgent?: string;
    clickedUrl?: string;
    [key: string]: any;
  };
  createdAt: Date;
}

export interface EmailCampaignStats {
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  dropped: number;
  openRate: number;
  clickRate: number;
  deliveryRate: number;
}

export interface PropertyEmailStats extends EmailCampaignStats {
  propertyId: string;
  propertyTitle?: string;
  campaignPeriod: {
    start: Date;
    end: Date;
  };
}

export interface EmailAnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
  propertyId?: string;
  recipientEmail?: string;
  eventTypes?: EmailAnalyticsEvent['eventType'][];
}
