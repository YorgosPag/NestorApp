/**
 * =============================================================================
 * ENTERPRISE: CALENDAR REMINDERS API ROUTE
 * =============================================================================
 *
 * GET: Check for due reminders and create notifications in Firestore.
 * Queries tasks where reminderDate <= now AND reminderSent != true,
 * creates notification documents, and marks reminders as sent.
 *
 * @module app/api/calendar/reminders/route
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateNotificationId } from '@/services/enterprise-id.service';
import { getErrorMessage } from '@/lib/error-utils';

export const dynamic = 'force-dynamic';

interface ReminderTask {
  id: string;
  title: string;
  dueDate: string;
  reminderDate: string;
  reminderSent: boolean;
  assignedTo: string;
  companyId: string | null;
}

export async function GET() {
  try {
    const adminDb = getAdminFirestore();
    const now = new Date().toISOString();

    // Query tasks where reminderDate <= now AND reminderSent != true
    const tasksRef = adminDb.collection(COLLECTIONS.TASKS);
    const snapshot = await tasksRef
      .where('reminderDate', '<=', now)
      .where('reminderSent', '!=', true)
      .limit(50)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ processed: 0, message: 'No pending reminders' });
    }

    const batch = adminDb.batch();
    const reminders: ReminderTask[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const task: ReminderTask = {
        id: doc.id,
        title: (data.title as string) ?? 'Untitled',
        dueDate: (data.dueDate as string) ?? '',
        reminderDate: (data.reminderDate as string) ?? '',
        reminderSent: (data.reminderSent as boolean) ?? false,
        assignedTo: (data.assignedTo as string) ?? '',
        companyId: (data.companyId as string) ?? null,
      };
      reminders.push(task);

      // Create notification document
      const notifRef = adminDb.collection(COLLECTIONS.NOTIFICATIONS).doc(generateNotificationId());
      batch.set(notifRef, {
        type: 'taskDue',
        title: `Reminder: ${task.title}`,
        body: `Task "${task.title}" is due soon`,
        userId: task.assignedTo,
        companyId: task.companyId ?? null,
        read: false,
        createdAt: new Date().toISOString(),
        metadata: {
          taskId: task.id,
          dueDate: task.dueDate,
        },
      });

      // Mark reminder as sent
      batch.update(doc.ref, { reminderSent: true });
    }

    await batch.commit();

    return NextResponse.json({
      processed: reminders.length,
      tasks: reminders.map((r) => ({ id: r.id, title: r.title })),
    });
  } catch (error) {
    const message = getErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
