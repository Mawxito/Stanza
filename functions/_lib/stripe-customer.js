// The Stripe customer of a signed-in buyer: created once from their portal account, then reused,
// so every payment, invoice and receipt of a client sits on one Stripe record carrying their
// details (name, e-mail, company) and the id of their portal account (metadata.portal_user).

/**
 * @param stripe  Stripe client
 * @param who     { uid, email, name, company, locale } from verifyCheckoutToken
 * @returns the Stripe customer id
 */
export async function ensureCustomer(stripe, who) {
  const info = {
    email: who.email,
    name: who.name || undefined,
    preferred_locales: [who.locale],
    metadata: { portal_user: who.uid, ...(who.company ? { company: who.company } : {}) },
  };
  const find = async () => {
    const { data } = await stripe.customers.list({ email: who.email, limit: 10 });
    return data.find((c) => !c.deleted && c.metadata && c.metadata.portal_user === who.uid) || null;
  };

  const existing = await find();
  if (existing) {
    // Name or company changed in the portal: keep the Stripe record current.
    if ((who.name && existing.name !== who.name) || (who.company || '') !== (existing.metadata.company || '')) {
      await stripe.customers.update(existing.id, { name: who.name || undefined, metadata: { company: who.company || '' } });
    }
    return existing.id;
  }
  try {
    // One customer per portal account even if two checkouts start at the same moment.
    const created = await stripe.customers.create(info, { idempotencyKey: `stanza-customer-${who.uid}` });
    return created.id;
  } catch (err) {
    // Same key reused within 24 h with different details (e-mail changed): look again, else fail.
    const again = await find();
    if (again) return again.id;
    throw err;
  }
}
