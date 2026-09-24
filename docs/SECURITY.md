# Security model

Implementation reviewed: 2026-09-24. This document describes the current implementation, not an independent audit or certification.

## Trust boundaries

The intended protection is confidentiality of session content from the hosting/database operators and people who lack the invitation, assuming participants receive the authentic, uncompromised frontend and use uncompromised browsers. The Convex database never receives the invitation secret or a room content key.

An invitation is a bearer secret: possession conveys the ability to derive the content key and, subject to admission policy, join. A 256-bit link is generated from 32 CSPRNG bytes. A passphrase contains 12 independently selected words from a 2,048-word list, for 132 bits of entropy. Both choices provide a shareable URL with the secret in the **fragment**, never in the path/query. The fragment is consumed and removed from the visible URL on load. This does not prevent the original link from being retained by chat systems, clipboard history, browser history/sync, extensions, or screenshots.

Host approval is an authorization control, not cryptographic identity verification. Pending clients receive only their waiting status and expiry. Host-visible pending names are encrypted. Names can be impersonated; hosts should verify arrivals out of band. Declined people can request again with another capability; this is not identity-based banning.

## Cryptographic construction

| Purpose            | Construction                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Random link        | 32 bytes from Web Crypto `getRandomValues`, hexadecimal                                                           |
| Word passphrase    | 12 unbiased 11-bit selections from the bundled BIP-39 English list; no wallet or mnemonic checksum semantics      |
| Lookup identifier  | SHA-256 of `quorum:room:v1:` plus canonical invitation secret                                                     |
| Content key        | Nonextractable AES-256-GCM key derived with HKDF-SHA-256 from the secret; salt `quorum:v1`, info `room-content`   |
| Message encryption | AES-GCM with a fresh 96-bit random IV per message and 128-bit authentication tag                                  |
| Padding            | Every content envelope holds 2,048 plaintext bytes, including a two-byte length prefix                            |
| Session capability | Independent random 256-bit token, transmitted over TLS; only SHA-256 of `quorum:session:v1:` plus token is stored |

The public room lookup digest cannot be substituted for the invitation to derive the content key: key derivation uses the original secret and an independent domain. Tests check this explicitly. Room encryption keys are never exported through the Web Crypto API. JavaScript still holds the original invitation to support sharing; nonextractability does not protect a compromised page.

AES-GCM additional authenticated data binds each ciphertext to the room and its purpose:

- Config: `<room hash>:config`
- Display name: `<room hash>:name:<participant id>`
- Queue item: `<room hash>:item:<item id>`
- Vote: `<room hash>:vote:<participant id>:<round number>`

Fresh IVs prevent deterministic ciphertext; padding reduces length leakage for individual fields. It does not hide member counts, number of messages, queue length, access times, message frequency, roles, host identifier, reveal state, admission policy, or expiry. Hosting/network providers can also observe IP addresses and connection metadata.

This is a shared-secret group design. It does **not** offer forward secrecy, post-compromise security, per-recipient cryptographic admission, or automatic group-key rotation. Every invite holder already knows the room key, including a pending or rejected applicant. Admission prevents their API access to ciphertext, but cannot prevent decryption if someone later gives them ciphertext. Create a new room and share a new invitation after a suspected leak. A stronger enterprise model would require individually authenticated clients and audited group key management, such as a reviewed MLS-based design.

## Voting and queue integrity

Only admitted participants with unexpired presence can read content or mutate state. The server verifies capabilities for every operation; the browser UI is not the authorization boundary. Host controls are separately authorized by the participant identifier associated with that capability. Observers cannot vote. Only the host can reveal, reset, advance, lock, admit, or remove people. Removal deletes the participant record, vote, and capability hash; it does not rotate the shared encryption key or prevent a new invitation-based request.

Before reveal, public query results omit other participants’ vote ciphertext entirely, including for the host. A participant can retrieve their own encrypted vote. The database nevertheless holds the encrypted votes: a compromised server colluding with an invitation holder could expose them early. The current design trusts the server to enforce release timing; it does not implement a cryptographic commit/reveal protocol. This is distinct from the confidentiality of votes from a server that has no room key.

Voting, reveal, reset, and advancement carry an expected round number. A stale/retried action cannot modify another round. The host must reveal before advancing. Finishing an item removes its ciphertext and clears all votes in one transaction. Revoting retains the current item and discards prior votes.

After receiving a reveal, each open browser displays its own three-second countdown before showing cards and enabling progression. This is presentation timing, not a second security boundary: the server releases encrypted votes when it commits the reveal. A newly opened view of an already revealed round shows results immediately.

The server cannot validate encrypted card values. It validates envelope format and size; clients reject invalid/tampered plaintext and exclude unreadable votes from summaries. No unsafe HTML is rendered. Optional item links are locally validated as HTTP(S), without embedded credentials, and opened with `noopener noreferrer`. There is no fetcher, metadata preview, third-party integration, or automatic navigation.

## Retention behavior

Encryption and retention describe different guarantees. Room content is encrypted before it reaches Convex; persisted content and copies in provider backups are ciphertext, unreadable without the invitation-derived room key. The operator and providers do not receive that key through the application. Retaining ciphertext is not equivalent to retaining readable submissions. Connection and room-operation metadata are separate and are not end-to-end encrypted.

This is not cryptographic erasure: invitation holders can retain their keys, and a retained key can still decrypt matching ciphertext later. The shared-key design has no forward secrecy. These boundaries do not negate content confidentiality from a provider without the key; they qualify the stronger claim that no data exists anywhere after a room ends.

- Active room content, participant capabilities (hashed), pending requests, queue, and votes occupy one room record.
- Host ending the room atomically deletes that record and cancels the expiry task. A leaving participant’s data is removed; a waiting applicant can cancel.
- Each room has an absolute server-selected deadline of 1, 2, 4, or 8 hours. Reads and mutations reject expired rooms even if cleanup has not run.
- Scheduled expiry deletes the record. A five-minute cron backstop sweeps expired rooms and old global rate-limit buckets in bounded batches. Backend suspension, outages, restore procedures, or scheduler failures can delay physical deletion; this is not a deletion SLA.
- No completion/history table exists. Application code does not log content, secrets, or participant tokens. Error text is generic and does not interpolate submitted content.
- Clients send heartbeats every 20 seconds while admitted or pending. The server rate-limits heartbeat writes to once per 15 seconds and returns the actual acknowledged deadline. After 120 seconds without presence, reads, mutations, and recovery reject the capability even before cleanup. A cron checks due rooms every 30 seconds in bounded batches, deletes stale participants and votes, and transfers hosting to the first surviving participant in admission order (including observers). All admitted clients receive the new host and change timestamp. A room with no surviving admitted participant is deleted, even if applicants are waiting. Scheduler outages can delay physical cleanup and transfer.
- Closing a tab does not immediately end a server-side room. Refreshing the same tab restores an existing live session. Explicit ending, presence cleanup, and absolute expiry are the deletion controls.
- At leave/observed closure/removal/expiry, the live UI clears its sessionStorage entry, unmounts, and releases session and decrypted-state references. The Convex client is closed and replaced to release cached capability arguments and ciphertext. This cannot guarantee secure memory wiping by a browser/OS or erase copies already made by people.
- Provider transaction history, snapshots, operational logs, scheduled-function records, diagnostics, and backups are subject to provider controls. They are not erased by deleting a room document.

## Frontend and operational defenses

Same-tab recovery stores only the invitation secret, private capability, participant ID, room expiry, and last acknowledged recovery deadline under `quorum.session.v1` in sessionStorage. Room plaintext and CryptoKey objects are not serialized. On reload, the client renews the existing capability through `heartbeat`, checks the returned participant ID, and re-derives the content key locally. Recovery never calls join or create; removed/stale capabilities cannot recreate the old participant. Storage failures disable refresh recovery without preventing a live session. Session storage is readable by same-origin scripts and must be treated as sensitive: it contains the original invitation from which the content key can be derived. Browser tab duplication/session restoration may copy or retain it; copied credentials share the same participant until invalidated. There is no recovery across browsers or verified user identity.

The decrypted room name appears in the browser tab title during a session, as requested by the user, and the normal title is restored on exit. Browser tab UI, browser/OS restoration, extensions, and screenshots can expose or retain that title. The title is set only in the browser; it is not included in a server-rendered route or URL.

The Next.js shell uses fresh per-request script nonces and `strict-dynamic`, with no production `unsafe-inline` or `unsafe-eval` script permission. A narrowly scoped `connect-src` permits the configured Convex endpoint. Style attributes remain allowed for local UI rendering. Framing, object embeds, base-tag injection, camera, microphone, payment, and geolocation are blocked. Referrers are disabled. HTML is served without caching; build assets contain no room data. There are no third-party fonts, analytics, trackers, or service workers.

A compromised hosting account, build pipeline, frontend dependency, or injected page script can steal keys **before encryption**. Browser E2EE alone does not solve supply-chain integrity. Production controls must include protected branches/builds, least-privilege deployment credentials, locked dependencies, vulnerability monitoring, external review, and no unreviewed injected scripts. CSP is defense in depth, not proof that the frontend is trustworthy.

Resource guards include room/member/pending/queue/content limits, a transactional global quota of 60 room creations per minute, and a minimum write interval for item additions/votes. These guards do not identify attackers and can be exhausted to deny service. WAF protection on Vercel alone does not cover direct Convex calls. Before public launch, add backend-verifiable abuse controls, project usage caps, and a response runbook. Decide what minimal abuse metadata can be retained before implementing per-client/IP controls.

## Reporting

Configure an operator-owned private security contact and incident process before production rollout. Do not invite sensitive data into the application until deployment settings, evidence, and the acceptance criteria in `ENTERPRISE-READINESS.md` are reviewed.
