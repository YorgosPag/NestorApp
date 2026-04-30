// ADR-329: Quote Comments — client-side types and API helpers
// Mutations go through /api/quotes/[id]/comments/* (withAuth + Admin SDK)

export interface QuoteComment {
  id: string;
  companyId: string;
  quoteId: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: { seconds: number; nanoseconds: number } | string;
  editedAt: { seconds: number; nanoseconds: number } | string | null;
  deletedAt: null;
  mentionedUserIds: string[];
}

export function formatCommentDate(
  ts: QuoteComment['createdAt'] | QuoteComment['editedAt'],
): string {
  if (!ts) return '';
  if (typeof ts === 'string') return new Date(ts).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' });
  return new Date(ts.seconds * 1000).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' });
}

async function listComments(quoteId: string): Promise<QuoteComment[]> {
  const res = await fetch(`/api/quotes/${quoteId}/comments`);
  if (!res.ok) throw new Error(`listComments failed: ${res.status}`);
  const json = (await res.json()) as { data: QuoteComment[] };
  return json.data;
}

async function createComment(
  quoteId: string,
  text: string,
  authorName: string,
  mentionedUserIds: string[] = [],
): Promise<QuoteComment> {
  const res = await fetch(`/api/quotes/${quoteId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, authorName, mentionedUserIds }),
  });
  if (!res.ok) throw new Error(`createComment failed: ${res.status}`);
  const json = (await res.json()) as { data: QuoteComment };
  return json.data;
}

async function editComment(quoteId: string, commentId: string, text: string): Promise<void> {
  const res = await fetch(`/api/quotes/${quoteId}/comments/${commentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`editComment failed: ${res.status}`);
}

async function deleteComment(quoteId: string, commentId: string): Promise<void> {
  const res = await fetch(`/api/quotes/${quoteId}/comments/${commentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`deleteComment failed: ${res.status}`);
}

export const quoteCommentService = {
  listComments,
  createComment,
  editComment,
  deleteComment,
};
