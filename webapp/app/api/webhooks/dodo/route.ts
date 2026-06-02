/**
 * POST /api/webhooks/dodo — Dodo Payments subscription webhook.
 *
 * Verifies the Standard Webhooks signature, then on activation/renewal/payment
 * grants the plan to the matching user (mapped by metadata.user_id, falling
 * back to customer email), and on hold/failure marks it inactive. The plan is
 * stored in Supabase auth user_metadata: { plan, plan_status, dodo_* }.
 *
 * Setup:
 *   - In the Dodo dashboard add a webhook to
 *       https://studio.creatorcrew.app/api/webhooks/dodo
 *     and copy its signing secret into env DODO_WEBHOOK_SECRET.
 *
 * NOTE: the exact payload field paths below are best-effort and should be
 * confirmed against a real Dodo event (log `event` once and adjust if needed).
 */
import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import { planForProduct, type PlanId } from "@/lib/billing";

export const runtime = "nodejs";

/** Standard Webhooks: signed content is `${id}.${timestamp}.${body}`, HMAC-SHA256. */
function verifySignature(
  rawBody: string,
  headers: Headers,
  secret: string
): boolean {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return false;

  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : Buffer.from(secret, "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${ts}.${rawBody}`)
    .digest("base64");

  // Header is space-separated "v1,<sig>" pairs.
  return sigHeader.split(" ").some((part) => {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

type DodoEvent = {
  type?: string;
  data?: {
    customer?: { email?: string };
    email?: string;
    metadata?: Record<string, string>;
    product_id?: string;
    product_cart?: { product_id?: string }[];
    subscription_id?: string;
    customer_id?: string;
  };
};

const ACTIVE_EVENTS = new Set([
  "subscription.active",
  "subscription.renewed",
  "payment.succeeded",
]);
const INACTIVE_EVENTS = new Set([
  "subscription.on_hold",
  "subscription.failed",
  "payment.failed",
]);

export async function POST(request: NextRequest) {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "DODO_WEBHOOK_SECRET not configured" },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: DodoEvent;
  try {
    event = JSON.parse(rawBody) as DodoEvent;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const type = event.type || "";
  const data = event.data || {};
  const email = data.customer?.email || data.email || null;
  const userId = data.metadata?.user_id || null;

  if (ACTIVE_EVENTS.has(type)) {
    const productId = data.product_id || data.product_cart?.[0]?.product_id;
    const plan =
      planForProduct(productId) ||
      ((data.metadata?.plan as PlanId | undefined) ?? null);
    await setEntitlement({
      userId,
      email,
      plan,
      status: "active",
      subscriptionId: data.subscription_id,
      customerId: data.customer_id,
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
