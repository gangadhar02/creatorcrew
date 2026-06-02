/**
 * POST /api/webhooks/dodo — Dodo Payments subscription webhook.
 *
 * Verifies the Standard Webhooks signature (via the `standardwebhooks` lib that
 * Dodo recommends), then on activation/renewal/payment grants the plan to the
 * matching user (mapped by metadata.user_id, falling back to customer email),
 * and on hold/cancel/fail marks it inactive. The plan is stored in Supabase auth
 * user_metadata: { plan, plan_status, dodo_* }.
 *
 * Setup:
 *   - Dodo dashboard → Webhooks → add
 *       https://studio.creatorcrew.app/api/webhooks/dodo
 *     and copy its signing secret into env DODO_PAYMENTS_WEBHOOK_KEY.
 *
 * Payload shape (per Dodo docs): { business_id, type, timestamp, data }, where
 * `data` is the subscription/payment object. Confirm field paths against a real
 * test event the first time (the handler logs unmatched users).
 */
import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "standardwebhooks";
import { getSupabase } from "@/lib/supabase";
import { planForProduct, type PlanId } from "@/lib/billing";

export const runtime = "nodejs";

type DodoEvent = {
  type?: string;
  data?: {
    subscription_id?: string;
    payment_id?: string;
    status?: string;
    product_id?: string;
    product_cart?: { product_id?: string }[];
    metadata?: Record<string, string>;
    customer?: { customer_id?: string; email?: string; name?: string };
  };
};

const ACTIVE_EVENTS = new Set([
  "subscription.active",
  "subscription.renewed",
  "payment.succeeded",
]);
const INACTIVE_EVENTS = new Set([
  "subscription.on_hold",
  "subscription.cancelled",
  "subscription.failed",
  "subscription.expired",
  "payment.failed",
]);

export async function POST(request: NextRequest) {
  const secret =
    process.env.DODO_PAYMENTS_WEBHOOK_KEY || process.env.DODO_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "DODO_PAYMENTS_WEBHOOK_KEY not configured" },
      { status: 500 }
    );
  }

  const rawBody = await request.text();

  let event: DodoEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(rawBody, {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    }) as DodoEvent;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const type = event.type || "";
  const data = event.data || {};
  const email = data.customer?.email ?? null;
  const userId = data.metadata?.user_id ?? null;

  if (ACTIVE_EVENTS.has(type)) {
    const productId = data.product_id || data.product_cart?.[0]?.product_id;
    const plan =
      planForProduct(productId) ??
      ((data.metadata?.plan as PlanId | undefined) ?? null);
    await setEntitlement({
      userId,
      email,
      plan,
      status: "active",
      subscriptionId: data.subscription_id,
      customerId: data.customer?.customer_id,
    });
  } else if (INACTIVE_EVENTS.has(type)) {
    await setEntitlement({ userId, email, plan: null, status: "inactive" });
  }

  return NextResponse.json({ received: true });
}

async function setEntitlement(args: {
  userId: string | null;
  email: string | null;
  plan: PlanId | null;
  status: "active" | "inactive";
  subscriptionId?: string;
  customerId?: string;
}) {
  const sb = getSupabase();

  let uid = args.userId;
  if (!uid && args.email) {
    // Map by email (service-role admin listing). Fine at small scale.
    const { data } = await sb.auth.admin.listUsers();
    uid =
      data?.users.find(
        (u) => u.email?.toLowerCase() === args.email!.toLowerCase()
      )?.id ?? null;
  }
  if (!uid) {
    console.warn("[dodo webhook] no matching user for", args.email);
    return;
  }

  // Merge so we don't clobber other metadata fields.
  const { data: current } = await sb.auth.admin.getUserById(uid);
  const meta = (current?.user?.user_metadata || {}) as Record<string, unknown>;

  await sb.auth.admin.updateUserById(uid, {
    user_metadata: {
      ...meta,
      plan: args.plan ?? meta.plan ?? null,
      plan_status: args.status,
      dodo_subscription_id: args.subscriptionId ?? meta.dodo_subscription_id,
      dodo_customer_id: args.customerId ?? meta.dodo_customer_id,
    },
  });
}
