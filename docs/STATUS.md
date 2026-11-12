# Build status & honesty table

Everything below was produced in this repository. **Test counts are from real executed runs**,
not estimates.

## Verified in this build

| Check | Command | Result |
| --- | --- | --- |
| Server typecheck | `cd server && npx tsc -p tsconfig.json --noEmit` | 0 errors |
| Server tests | `cd server && npx vitest run` | **6 files, 51 tests passed** |
| Client typecheck | `cd client && npx tsc --noEmit` | 0 errors |
| Client tests | `cd client && npx vitest run` | **4 files, 19 tests passed** |
| Client production build | `cd client && npx vite build` | succeeded — `dist/index.html` + `dist/assets/*` (≈760 kB JS / 212 kB gzip, 30 kB CSS) |

Test file breakdown (server): `auth.test.ts` 9 · `products.test.ts` 7 · `orders.test.ts` 7 ·
`payments.test.ts` 9 · `inventory.test.ts` 7 · `ai-analytics.test.ts` 12.
Client: `format.test.ts` 6 · `api.test.ts` 4 · `components.test.tsx` 7 · `auth-context.test.tsx` 2.

## Feature status

| Feature | Status | Notes |
| --- | --- | --- |
| Auth (register/login/logout/me/forgot/reset) | Working, tested | Cookie auth, bcrypt, single-use hashed reset tokens |
| Role-based authorization | Working, tested | Manager cannot DELETE products (403); cross-store access returns 404 |
| Dashboard metrics | Working | All values from `/api/analytics/overview` aggregations |
| Product CRUD + search/filter/sort/pagination | Working, tested | Delete auto-archives when order history exists |
| Order workflow + status transitions | Working, tested | Illegal transitions rejected; paid required before processing |
| PayPal create/capture (server priced + verified) | Working against mocks, tested | Real Sandbox round-trip **not** executed |
| PayPal webhook signature verification | Working against mocks, tested | Real PayPal signature **not** executed |
| Idempotent capture / duplicate protection | Working, tested | Replay returns `alreadyProcessed`, stock deducted once |
| Inventory movements + low-stock notifications | Working, tested | Atomic `$gte` guard; no replica-set requirement |
| AI chat, recommendations, description, insights | Working with deterministic fallbacks, tested | Rules engine used when no key is configured |
| Analytics endpoints | Working, tested | Asserted against real records created in the test DB |
| Notifications center | Working | Read/unread, mark-all, bell dropdown |
| Frontend pages (15 routes) | Working | Build succeeds; flows exercised only via unit/component tests |

## NOT verified — be aware

1. **No live PayPal Sandbox transaction.** All PayPal HTTP calls were mocked with `vi.stubGlobal('fetch')`.
   The signature-verification path was exercised against a mocked `verify-webhook-signature`
   response, not PayPal's real service. No credentials were available in this environment.
2. **No live AI provider call.** `AI_API_KEY` was empty/unstubbed in every run. The fallback paths
   (rules engine, template generator, deterministic insights) are what the tests assert. A real
   `chat/completions` round trip is unverified.
3. **No browser/E2E testing.** No Playwright/Cypress run, so no proof that the rendered UI behaves
   correctly in a real browser beyond component-level assertions and a successful production build.
4. **No MongoDB replica set.** Dev and tests use `mongodb-memory-server` in standalone mode, so
   multi-document transactions are **not** used or tested. Inventory safety comes from atomic
   `findOneAndUpdate` guards plus idempotency keys instead. Against Atlas (a replica set) you can
   wrap the same logic in a transaction.
5. **No email delivery.** Password reset returns the token in the API response outside production;
   no SMTP/provider is wired up.
6. **No image upload endpoint.** Products accept an image URL; `uploads/` is served statically and
   `MAX_UPLOAD_MB` is configured, but `multer` is installed and not yet exposed through a route.
7. **No refund API call.** Refunds are modelled in the ledger and dashboard, but no PayPal refund
   request is issued.
8. **Deployment not performed.** Vercel/Render/Atlas instructions are documented, never executed.
9. **Rate limits are configured but not asserted in tests** (limits are skipped under `NODE_ENV=test`).
