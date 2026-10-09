import { loadSession } from '@/lib/auth';
import { corsJson, isAllowedOrigin, preflight } from '@/lib/cors';
import { hmacHex } from '@/lib/crypto';
import { env, isConfigured, isDemo } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/checkout-token — appelé par stanzafix.com quand un visiteur connecté clique sur le bouton
// d'une offre. Renvoie une preuve d'identité courte, signée avec INTAKE_SIGNING_SECRET (le secret que le
// site partage déjà avec le portail) : le site la vérifie (functions/_lib/portal.js) et s'en sert pour créer
// ou retrouver le client Stripe de cet utilisateur, puis préremplir le paiement. Acheter exige un compte.
//
// Format : `<base64url(JSON)>.<HMAC-SHA256 hex de "checkout.<base64url>">`, valable 10 minutes.
// Sécurité : mêmes garde-fous que /api/site-request — Origin exact du site, requête JSON « non simple »
// (préflight CORS), session Supabase en cookie httpOnly. Le jeton ne contient ni mot de passe ni jeton de session.

const METHODS = 'POST, OPTIONS';
const TTL_SECONDS = 600;

export function OPTIONS(request: Request) {
  return preflight(request, METHODS);
}

export async function POST(request: Request) {
  const reply = (body: unknown, status = 200) => corsJson(request, body, { status, methods: METHODS });

  if (!isAllowedOrigin(request.headers.get('origin'))) return reply({ error: 'forbidden' }, 403);
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return reply({ error: 'unsupported_media_type' }, 415);
  }
  if (isDemo || !isConfigured || !env.intakeSecret || env.intakeSecret.length < 32) return reply({ error: 'unavailable' }, 503);

  const state = await loadSession();
  if (state.kind !== 'ok') return reply({ error: 'unauthenticated' }, 401);
  const { profile } = state;

  if (!(await rateLimit('checkout-token', profile.id, 30, 3600))) return reply({ error: 'too_many_requests' }, 429);

  const body = Buffer.from(JSON.stringify({
    v: 1,
    uid: profile.id,
    email: profile.email,
    name: (profile.full_name ?? '').trim().slice(0, 200),
    company: (profile.company ?? '').trim().slice(0, 200),
    locale: profile.locale === 'en' ? 'en' : 'fr',
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  })).toString('base64url');
  return reply({ token: `${body}.${hmacHex(env.intakeSecret, `checkout.${body}`)}` });
}
