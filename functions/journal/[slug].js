// GET /journal/<slug> — one article of the journal, or a 404 page (see _lib/journal.js).
import { journalArticle } from '../_lib/journal.js';

export function onRequest(context) {
  const { request } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  return journalArticle(context);
}
