// Worker entry point: static files in ./public are served by the assets binding,
// requests that match no file (the /api/* routes) land here.
import * as checkout from '../functions/api/checkout.js';
import * as stripeWebhook from '../functions/api/stripe-webhook.js';

const ROUTES = {
  '/api/checkout': checkout,
  '/api/stripe-webhook': stripeWebhook,
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const route = ROUTES[pathname.replace(/\/$/, '')];
    if (!route) return env.ASSETS.fetch(request);

    const method = request.method.charAt(0) + request.method.slice(1).toLowerCase();
    const handler = route[`onRequest${method}`];
    if (!handler) return new Response('Method Not Allowed', { status: 405 });
    return handler({ request, env, ctx });
  },
};
