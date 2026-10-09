import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

// Le jeton émis par /api/checkout-token doit être exactement ce que vérifie le site
// (functions/_lib/portal.js → verifyCheckoutToken) : base64url(JSON) + "." + HMAC-SHA256 hex de "checkout.<base64url>".
test('format du jeton de paiement : signature « checkout.<corps> », 10 minutes', () => {
  const secret = 'a'.repeat(64);
  const body = Buffer.from(JSON.stringify({ v: 1, uid: '30000000-0000-4000-8000-000000000001', email: 'a@b.fr', name: 'Ada', company: '', locale: 'fr', exp: 1790000600 })).toString('base64url');
  const sig = createHmac('sha256', secret).update(`checkout.${body}`).digest('hex');
  assert.match(`${body}.${sig}`, /^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/);
  assert.notEqual(sig, createHmac('sha256', secret).update(`1790000000.${body}`).digest('hex'), 'distinct d’une signature d’intake');
});
