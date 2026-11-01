# frontend-gelato-management

Next.js frontend for GelatoFlow. It talks only to the backend API Gateway
(`backend-gelato-management/api-gateway`) and follows the versioned contracts in
`backend-gelato-management/contracts/openapi`.

## Run

```bash
cp .env.example .env.local   # set API_GATEWAY_URL (default http://localhost:8080)
npm ci
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`.

## How requests reach the backend

```
browser ──same-origin /api/v1/*──▶ Next.js route handlers ──Bearer JWT──▶ API Gateway ──▶ services
```

- `POST /api/v1/auth/login` calls Auth through the Gateway and stores the
  `access_token` in the httpOnly `gelatte_session` cookie (lifetime = `expires_in`,
  15 minutes by default; Auth has no refresh tokens).
- `POST /api/v1/auth/logout` clears the cookie.
- Every other `/api/v1/*` call goes through `app/api/v1/[...path]/route.ts`, which
  swaps the cookie for `Authorization: Bearer <token>`. An expired token is dropped
  so public reads (menu, availability) still work.
- The frontend decodes but does not verify the token: it is only used for page
  redirects (`proxy.ts`) and for role checks the backend does not yet make
  (Fulfillment → STAFF/MANAGER, Analytics → MANAGER). The Gateway verifies every
  forwarded token, so no `JWT_SECRET` is needed here.

## Contract mapping

| Screen | Backend calls |
| --- | --- |
| Menu | `GET /flavors?active=true` + `GET /inventory/availability`, joined by `flavor_id` |
| Cart / checkout | `POST /orders` with `Idempotency-Key` and `{pickup_at, items}`, then redirect to `checkout_url` (Stripe Checkout) |
| Order page `/queue/[orderId]` | `GET /orders/{id}` (polled), `POST /orders/{id}/cancel`; queue number from the `order.ready` notification |
| Notifications | `GET /notifications/stream` (SSE) |
| Kitchen `/staff` | `GET /fulfillments?status=PREPARING,READY_FOR_PICKUP`, `PATCH /fulfillments/{order_id}/status` |
| Manager `/manager` | `GET/POST/PATCH/DELETE /flavors`, `GET/POST /inventory/batches`, `POST /inventory/batches/{id}/waste` |
| Analytics | `GET /analytics/summary?period=1d|1w|1m|6m` |

Money is integer satang (`*_minor`) everywhere except the analytics summary, which
still returns baht.

## Backend configuration this frontend expects

- Payment `STRIPE_CHECKOUT_SUCCESS_URL=<site>/checkout/return?session_id={CHECKOUT_SESSION_ID}`
- Payment `STRIPE_CHECKOUT_CANCEL_URL=<site>/checkout/return?cancelled=1`
- Signup only creates CUSTOMER accounts; STAFF and MANAGER users must be promoted in the
  Auth database (see `backend-gelato-management/docs/deployment.md`).
- The Gateway forwards the verified identity as `X-User-ID`/`X-User-Role` and routes
  `/api/v1/notifications/stream`, so `NOTIFICATION_SERVICE_URL` can stay empty.

## Known backend gaps

- Order never moves past `PAID` (Fulfillment status is not fed back), so the order page
  relies on the `order.ready` notification to show "ready" and the queue number.

## Production image

`next.config.mjs` builds with `output: "standalone"`. The `Dockerfile` produces a
small Node 22 image that listens on port 3000 and needs only `API_GATEWAY_URL` at
runtime:

```bash
docker build -t gelatoflow-frontend .
docker run -p 3000:3000 -e API_GATEWAY_URL=http://api-gateway:8080 gelatoflow-frontend
```

The backend repository's `infra/docker/compose.prod.yml` builds this image from a
sibling checkout and serves it behind Caddy with HTTPS. Set `NODE_ENV=production`
(the image does) so the session cookie is marked `Secure`.
