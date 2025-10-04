
"use client";

import { Timestamp } from 'firebase/firestore';

export function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  
  // Handle Firestore Timestamps
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }

  // Handle ISO strings or Date objects
  if (value instanceof Date) {
    return value;
  }
  
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  return null;
}

    