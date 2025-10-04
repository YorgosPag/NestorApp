// /home/user/studio/src/app/api/communications/webhooks/telegram/shared/types.ts

export type Direction = 'inbound' | 'outbound';

export interface CRMMessage {
  type: 'telegram';
  direction: Direction;
  channel: 'telegram';
  from: string;
  to: string;
  content: string;
  status: 'received' | 'sent';
  entityType: 'lead';
  entityId: string | null;
  externalId: string | null;
  metadata: {
    userName: string;
    platform: 'telegram';
    chatId: number | string;
  };
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface SearchCriteria {
  maxPrice?: number;
  rooms?: number;
  type?: 'apartment' | 'maisonette' | 'store';
}

export interface SearchResult {
  success: boolean;
  properties: any[];
  totalCount: number;
  criteria: Partial<SearchCriteria>;
  message: string;
}
