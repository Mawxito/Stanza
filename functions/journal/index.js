// GET /journal — the list of articles, with filters from the query string (see _lib/journal.js).
import { journalList } from '../_lib/journal.js';

export function onRequest(context) {
  const { request } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  return journalList(context);
}
