/**
 * Billing config — Dodo Payments plans.
 *
 * The hosted checkout links (and their product ids) come from the Dodo
 * dashboard. We send authenticated users to these with their email prefilled +
 * a `metadata_user_id` so the webhook can map a payment back to the account.
 */
export type PlanId = "creator" | "pro";

export const DODO_PLANS: Record<
  PlanId,
  { productId: string; checkoutUrl: string; label: string }
> = {
  creator: {
    productId: "pdt_0NgAiOVI2Q8rkc7EDkRdg",
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NgAiOVI2Q8rkc7EDkRdg",
    label: "Creator",
  },
  pro: {
    productId: "pdt_0NgAiVspyU3t75R4OEHcc",
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NgAiVspyU3t75R4OEHcc",
    label: "Pro",
  },
};

export function isPlanId(v: string | null | undefined): v is PlanId {
  return v === "creator" || v === "pro";
}

/** Reverse-map a Dodo product id back to our plan id (used by the webhook). */
export function planForProduct(productId: string | undefined): PlanId | null {
  if (!productId) return null;
  for (const [id, cfg] of Object.entries(DODO_PLANS)) {
    if (cfg.productId === productId) return id as PlanId;
  }
  return null;
}
