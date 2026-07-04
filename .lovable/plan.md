Marine Video Portal — Build Plan

# Private, invite-only video site. Rebuilt on Lovable's stack (TanStack Start + Lovable Cloud) instead of Next.js/Auth0/Upstash. Feature parity with the reference repo; different plumbing.

## Stack mapping


| Reference repo   | This build                                                 |
| ---------------- | ---------------------------------------------------------- |
| Auth0            | Lovable Cloud auth (email/password + Google)               |
| Upstash Redis    | Postgres (Lovable Cloud)                                   |
| bunny.net Stream | bunny.net Stream (kept, per your choice)                   |
| Vercel Next.js   | TanStack Start server functions + routes                   |
| Sentry           | Lovable's built-in error reporting                         |
| —                | Lovable Emails for auth + share invites + approval notices |


## Access model

- **Admin**: email in `user_roles` with role `admin`. Server-checked on every admin action.
- **Approved viewer**: row in `approved_viewers` (email). Case-insensitive match to `session.user.email`.
- **Share recipient**: row in `share_links` (recipient email + token + expiry + viewed_at). Forced login + email match to open.
- Unapproved signed-in users see a "not approved" page.
- Rate-limiting on video list, share creation, upload signing (Postgres sliding window, fails open).

## Database (Lovable Cloud)

- `user_roles(user_id, role)` + `has_role()` security-definer fn (per Lovable's user-roles pattern)
- `approved_viewers(id, email citext unique, added_by, added_at, last_seen_at)`
- `video_metadata(bunny_video_id pk, title, collection_id, sort_order, created_at)` — mirrors bunny.net library
- `collections(id, name, created_at)`
- `share_links(id, token unique, bunny_video_id, recipient_email citext, expires_at, viewed_at, created_by, revoked_at)`
- `watch_progress(user_id, bunny_video_id, position_seconds, duration_seconds, updated_at)` (composite PK)
- `settings(key pk, value jsonb)` — homepage count, palette
- `audit_log(id, actor_email, action, target, meta jsonb, created_at)` — capped via trigger
- `rate_limits(bucket, key, window_start, count)` — sliding window

All tables: RLS on. `GRANT` blocks per Lovable's public-schema rule. Owner-scoped SELECT for `watch_progress`; admin-only for `approved_viewers`, `share_links`, `settings`, `audit_log`, `rate_limits`. `video_metadata` and `collections` readable by approved viewers via server fn (RLS uses `has_role` + approved-viewer check helper).

## Server functions (`createServerFn`)

- `getLibraryPage({q, collectionId, page})` — approved-viewer gated, returns metadata + signed thumbnail URLs
- `getSignedEmbed({bunnyVideoId})` — approved-viewer OR valid share; returns time-limited signed iframe URL
- `saveProgress({bunnyVideoId, position, duration})`
- `getContinueWatching()`
- Admin fns: `listVideos`, `renameVideo`, `deleteVideo`, `reorderVideos`, `setVideoCollection`, `createTusUpload`, `listViewers`, `addViewers` (bulk), `removeViewer`, `createShare`, `listShares`, `revokeShare`, `listCollections`, `createCollection`, `deleteCollection`, `getSettings`, `updateSettings`, `getPalette`, `updatePalette`, `getAudit`, `getAnalytics`

All admin fns start with `requireSupabaseAuth` + `has_role('admin')` check + audit log write.

## Server routes

- `/api/public/shares/[token]` — validates share, forces login (redirects), then serves signed embed
- Auth pages: `/auth`, `/auth/callback`, `/reset-password`
- App pages under `_authenticated/`: `/` (library), `/watch/$videoId`, `/admin` (tabbed)
- Share landing: `/s/$token` (public, but forces sign-in and email match)

## bunny.net integration (server-only)

`src/lib/bunny.server.ts`:

- List/create/update/delete videos, collections
- TUS upload signing (HMAC of libraryId + apiKey + expiration + videoId)
- Signed embed URL (HMAC-SHA256 with `BUNNY_TOKEN_AUTH_KEY` + expiration + optional viewer IP)
- Signed thumbnail URL (pull-zone token key)
- Statistics fetch (for analytics tab)

Secrets requested via `add_secret`: `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `BUNNY_TOKEN_AUTH_KEY`, `BUNNY_CDN_HOSTNAME`, optional `BUNNY_CDN_TOKEN_KEY`.

## Admin panel (`/admin`, tabbed)

1. **Videos** — drag-drop upload (tus-js-client via signed endpoint), list with search, rename, delete, drag-reorder, per-video collection, per-video share creation, encoding-status badges. Collections sub-manager.
2. **Viewers** — list with last-seen, add single/bulk, remove.
3. **Shares** — active links with recipient, expiry, viewed status; revoke button.
4. **Settings** — homepage video count, palette picker (7 presets + custom), content-protection info.
5. **Activity** — recent `audit_log` rows.
6. **Analytics** — total views, 30-day chart, watch time, most-watched (from bunny stats + local aggregates).

## Emails (Lovable Emails)

After Cloud is up, I'll set up the email domain (you'll be prompted to choose one), then scaffold:

- **Auth emails** (branded confirm/reset/magic-link templates)
- **Share invite** — sent when admin creates a share link (recipient gets branded email with `/s/$token` URL)
- **Viewer approval notice** — sent when admin adds an approved viewer

Marketing/bulk emails not supported.

## Design system

Dark glassmorphism with gradient accents (matches reference "styles/globals.css"). Inter font via `@fontsource/inter`. Palette variables in `src/styles.css` as oklch tokens driven by `settings.palette` at runtime (CSS vars swapped by a small ThemeProvider that reads the public `getPalette` server fn).

## Security posture

- All admin gates server-side. `/admin` under `_authenticated/`; every admin server fn re-checks `has_role('admin')`.
- Bunny embed tokens generated fresh per request, short TTL (default 4h, tunable).
- Share tokens: 32-byte random, expiry required, recipient email match enforced server-side.
- Zod validation on every server-fn input.
- No secrets in client bundles; `BUNNY_*` read only inside handlers.
- 30-min idle sign-out on the client.
- Rate limits on: signed embed, upload signing, share creation, video list.
- Auth emails include leaked-password (HIBP) check enabled.
- Signup is open in Cloud auth — but access is gated by `approved_viewers`, so self-registration alone grants nothing. Optionally I can disable open signup entirely (admin-only viewer creation via Auth Admin API); tell me if you want that.

## Build order (one turn each, roughly)

1. Enable Lovable Cloud, request bunny.net secrets, install deps (`tus-js-client`, `@fontsource/inter`, `player.js`, `zod`).
2. Migrations: all tables + RLS + `has_role` + helpers + seed admin (asks you for admin email).
3. Design system + auth pages + `_authenticated` shell + "not approved" page.
4. `bunny.server.ts` + core server fns (library, signed embed, progress).
5. Home page (grid/list, search, filter, continue-watching, pagination).
6. Watch page + share landing.
7. Admin tabs: Videos + Collections + upload.
8. Admin tabs: Viewers + Shares.
9. Admin tabs: Settings (palette) + Activity + Analytics.
10. Email domain setup + auth email templates + share-invite + approval-notice templates + triggers.
11. SEO (`sitemap.xml`, `robots.txt`, per-route metadata), final polish, security scan.

## What I need from you before starting

1. **Admin email(s)** — comma-separated list to seed as admins (e.g. `you@example.com`).
2. **bunny.net credentials** — I'll trigger the secure `add_secret` prompt for `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `BUNNY_TOKEN_AUTH_KEY`, `BUNNY_CDN_HOSTNAME` (+ optional `BUNNY_CDN_TOKEN_KEY`) after you approve this plan.
3. **Open signup?** Keep Cloud sign-up open (viewers must still be on the approved list), or restrict signup to admin-created accounts only?
4. **Email sender domain** — you'll pick this in the setup dialog once we get to step 10. Confirm you have DNS access for the domain you want to send from.

Approve and I'll start with step 1.