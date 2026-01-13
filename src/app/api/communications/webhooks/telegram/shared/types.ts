// /home/user/studio/src/app/api/communications/webhooks/telegram/shared/types.ts

import type { Timestamp } from 'firebase/firestore';

export type Direction = 'inbound' | 'outbound';

/** Firestore Timestamp type for server-side operations */
export type FirestoreTimestamp = Timestamp | { toDate: () => Date } | Date;

/** Property data from Firestore for search results */
export interface TelegramProperty {
  id: string;
  name?: string;
  code?: string;
  type?: string;
  price?: number;
  rooms?: number;
  area?: number;
  address?: string;
  status?: string;
  building?: string;
  [key: string]: unknown;
}

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
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface SearchCriteria {
  maxPrice?: number;
  rooms?: number;
  area?: number;
  type?: string;
  floor?: number;
}

export interface SearchResult {
  success: boolean;
  properties: TelegramProperty[];
  totalCount: number;
  criteria: Partial<SearchCriteria>;
  message: string;
}
