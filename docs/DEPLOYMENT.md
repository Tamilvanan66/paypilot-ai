# Deployment guide

## Topology

```
Vercel (client/dist)  ──HTTPS──▶  Render (server/dist)  ──▶  MongoDB Atlas
                                        ▲
                                        └── PayPal webhooks (signature verified)
```

## 1. Database — MongoDB Atlas

1. Create a free M0 cluster.
2. *Database Access* → add a user with a strong password.
3. *Network Access* → allow your backend host's egress IPs (or `0.0.0.0/0` while testing).
4. Copy the connection string: `mongodb+srv://<user>:<pass>@<cluster>/paypilot?retryWrites=true&w=majority`.

Atlas is a replica set, so you can later wrap multi-document work in a `session.withTransaction`.

## 2. Backend — Render

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |

Environment variables (all of `server/.env.example`):

```
NODE_ENV=production
PORT=5000
CLIENT_ORIGIN=https://your-app.vercel.app
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<64+ random chars>
COOKIE_NAME=paypilot_token
RESET_TOKEN_TTL_MINUTES=30
AI_API_KEY=sk-...            # optional; deterministic fallbacks otherwise
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_CURRENCY=USD
PUBLIC_API_URL=https://your-api.onrender.com
MAX_UPLOAD_MB=5
```

Notes:
- `NODE_ENV=production` makes the session cookie `Secure` and `SameSite=None`, which is required for
  cross-site Vercel → Render requests.
- `server` must not be started with `tsx` in production — use the compiled `dist/server.js`.
- First deploy: run the seed once (`npm run seed`) if you want demo data, or register through the UI.

## 3. Frontend — Vercel

| Setting | Value |
| --- | --- |
| Root directory | `client` |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Env var | `VITE_API_URL=https://your-api.onrender.com` |

`VITE_API_URL` must have **no trailing slash** and must match the API origin exactly, otherwise the
browser will not send the session cookie.

Add `client/vercel.json` if you use client-side routes on a custom domain:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

## 4. Post-deploy checklist

- [ ] `GET https://<api>/api/health` returns `{ "success": true }`
- [ ] Register a user; the cookie is set and `/api/auth/me` returns the user
- [ ] Create a product, adjust stock, see the movement recorded
- [ ] Create an order, open it, pay with PayPal Sandbox, confirm `paid` + stock decrement
- [ ] Send a test webhook from the PayPal dashboard; expect `200` and no duplicate transaction
- [ ] CORS: `CLIENT_ORIGIN` exactly matches the deployed frontend origin
- [ ] Rotate `JWT_SECRET` only with the knowledge that it invalidates all sessions

## 5. Rollback

Render keeps previous deploys — use *Rollback* on the service. Vercel supports instant promotion of
a previous deployment. Neither requires a database change; all schema changes are additive.
