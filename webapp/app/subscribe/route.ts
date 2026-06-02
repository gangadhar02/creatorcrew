/**
 * GET /subscribe?plan=creator|pro
 *
 * The checkout entry point. This route is auth-gated by the proxy, so a
 * logged-out user clicking a plan is forced through signup first, then bounced
 * back here — satisfying "create an account before paying". Once authenticated,
 * we redirect to the Dodo hosted checkout for the plan with the user's email
 * prefilled + their user id as metadata, so the webhook can grant access to the
 * right account, and a return URL back into the app after payment.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { DODO_PLANS, isPlanId } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const plan = url.searchParams.get("plan");

  // Safety net — the proxy should have enforced auth already.
  const ws = await getWorkspaceContext();
  if (!ws.userId) {
    const next = `/subscribe${plan ? `?plan=${plan}` : ""}`;
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(next)}`, url.origin)
    );
  }

  if (!isPlanId(plan)) {
    // Unknown/missing plan — back to pricing on the app home.
    return NextResponse.redirect(new URL("/home", url.origin));
  }

  const cfg = DODO_PLANS[plan];
  const checkout = new URL(cfg.checkoutUrl);
  checkout.searchParams.set("quantity", "1");
  if (ws.workspaceEmail) checkout.searchParams.set("email", ws.workspaceEmail);
  // Best-effort metadata passthrough; the webhook also falls back to email.
  checkout.searchParams.set("metadata_user_id", ws.userId);
  checkout.searchParams.set("metadata_plan", plan);
  checkout.searchParams.set(
    "redirect_url",
    new URL("/home?subscribed=1", url.origin).toString()
  );

  return NextResponse.redirect(checkout.toString());
}
