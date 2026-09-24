# Quorum

An anonymous, end-to-end encrypted estimation app built with Next.js and Convex, configured for Vercel. Uses pnpm.

## What works

- Live rooms with story points, T-shirt sizes, hours, or 2–16 custom cards.
- Anonymous voter and observer roles; hosts can also observe.
- 256-bit random invitations or 12-word, 132-bit passphrases. Both have shareable links.
- Host approval enabled by default, a waiting room, and room locking.
- Hidden votes, host-controlled reveal, vote distribution, numeric averages, agreement, and revoting.
- A queue of up to 30 items, each with a **name and optional link**. No link fetching or previews. Everyone admitted can add items; only the host removes queued items and advances after reveal.
- Up to 32 admitted people and 32 waiting requests per room.
- End-to-end encryption of room settings, display names, card labels, item names/links, and votes.
- Immediate active-record deletion when the host ends the room; automatic 1/2/4/8-hour expiry, plus a cleanup backstop.
- Responsive interface, keyboard-accessible dialogs, reduced-motion support, and an explicitly labeled, in-memory practice room.

## Local setup

Use Node.js 22+ and pnpm. Dependency versions and the lockfile are checked in. Package caches are configured inside the repository.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Without a Convex URL, you can use the practice room. Live creation and joining stay disabled; the application never silently substitutes a mock backend.

To connect real rooms, create/select a Convex project and deployment. Choose the required data region before provisioning. This step contacts Convex and may write CLI credentials outside the repository; perform it only when authorized in your environment.

```sh
pnpm convex:dev
```

The CLI deploys the backend, replaces the bootstrap bindings under `convex/_generated`, and configures `.env.local`. Confirm the file includes:

```dotenv
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

Then run `pnpm dev` in a second terminal. Do not put room secrets, user data, or deployment keys in source control. There are no authentication providers to configure.

## Vercel

The checked-in `vercel.json` uses:

```sh
pnpm exec convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd "pnpm build"
```

1. Create a production Convex deployment in the appropriate region.
2. Import this repository as a Next.js Vercel project.
3. Add the production `CONVEX_DEPLOY_KEY` as a sensitive Vercel **Production-only** variable, scoped to the permissions needed to deploy. Never use a `NEXT_PUBLIC_` prefix for this key.
4. For Vercel previews, use a separate **Preview** Convex deploy key. Never point previews at production data.
5. Deploy, then test a host, voter, and observer in separate browser contexts.
6. Confirm the `Delete expired session data` cron is present and scheduled expiration actually deletes a test room.

This follows [Convex’s Vercel deployment workflow](https://docs.convex.dev/production/hosting/vercel). The build injects the correct client URL. `pnpm build` alone verifies the frontend without provisioning or contacting a backend.

Do not enable Vercel Analytics, session replay, third-party scripts, error-payload capture, or integration exports without updating the threat model and privacy notice. Disable the Vercel Toolbar on production; it would introduce an additional script trust boundary.

## Verification

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The unit/integration suite uses the real Convex function definitions with `convex-test` and isolated, in-memory persistence. It tests encrypted storage, cross-client decryption, incorrect keys, tampering, hidden votes, observer restrictions, host authorization, waiting-room isolation, queue progression, stale-round rejection, room locking, leaving, scheduled expiry, and deletion.

Browser tests exercise the actual production build, desktop/mobile layouts, voting, queues, admission, observing, dialogs, invitation-fragment consumption, response security headers, and absence of app cookies/web storage. They use an installed Microsoft Edge browser and a local server:

```sh
pnpm start --hostname 127.0.0.1 --port 3100
# In another terminal:
pnpm test:browser
```

On Windows, set `TEMP` and `TMP` to `<repository>/.tmp` before browser tests to keep test profiles inside the repository. If Edge is unavailable, change `channel` in `playwright.config.ts` to an approved installed browser. Do not install browsers globally without authorization.

The backend suite is an emulator test, not proof that a provisioned production deployment works. Complete the real two-browser smoke test after configuration.

## Architecture

| Area                                                 | Files                                              |
| ---------------------------------------------------- | -------------------------------------------------- |
| Next.js shell and per-request nonce CSP              | `src/app`, `src/proxy.ts`, `next.config.ts`        |
| Browser encryption and invitation handling           | `src/lib/crypto.ts`                                |
| Room creation, joining, waiting, decryption          | `src/components/app.tsx`, `live-room.tsx`          |
| Room interaction and practice adapter                | `room-view.tsx`, `practice-room.tsx`               |
| Transactional authorization, votes, queue, admission | `convex/rooms.ts`, `convex/lib.ts`                 |
| Schema, expiry, cron backstop                        | `convex/schema.ts`, `cleanup.ts`, `crons.ts`       |
| Security/retention research and rollout gaps         | `docs/SECURITY.md`, `docs/ENTERPRISE-READINESS.md` |

Convex stores each room as a single bounded document. Mutations atomically update membership, votes, and queue state. Public queries explicitly project authorized fields; neither participant tokens nor unrevealed votes from other members are sent to a caller. An opaque invitation hash locates the room. Content decryption happens only in browser code.

## Retention and limitations

This application provides **ephemeral encrypted rooms**, not an all-infrastructure zero-retention guarantee. Convex persists ciphertext while a room is active. Providers can retain operational metadata and backups. An invitation holder can keep keys or copy content, and deletion cannot revoke those copies.

Credentials and plaintext are held in JavaScript memory, with no app cookies, localStorage, sessionStorage, IndexedDB, or persisted room history. Refreshing loses the participant capability and host controls. A host must keep their tab open or end the room explicitly; abandoned rooms expire at their original deadline. No recovery key is stored on the server. Closing a browser tab is not a reliable deletion trigger. Browser/OS swap, crash dumps, extensions, clipboard history, and link-sharing services are outside the app’s control.

There is no enterprise SSO, organization tenancy, host transfer/recovery, device attestation, per-client abuse challenge, or independent security certification. The global creation quota and bounded rooms are resource guards, not comprehensive DoS protection. See the enterprise readiness report before accepting regulated or highly sensitive production data.
