import { useCartStore } from "@/store/useCartStore";
import { useNotificationStore } from "@/store/useNotificationStore";

/**
 * Binds the browser-wide stores to the signed-in user. Returns true when another user's data
 * was discarded. An expired session deliberately does not come through here: the same customer
 * logging back in (e.g. after a slow Stripe payment) must find their checkout intact.
 */
export function adoptSessionUser(userId: string) {
  useNotificationStore.getState().adoptOwner(userId);
  return useCartStore.getState().adoptOwner(userId);
}

/** Explicit logout: nothing of this account may remain for whoever uses the browser next. */
export function resetAccountState() {
  useNotificationStore.getState().reset();
  useCartStore.getState().reset();
}
