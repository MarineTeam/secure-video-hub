# Marine Team feature parity — phased upgrade

Secure Video Hub stays the foundation. No stack migration, no rebuild, no destructive schema changes. Everything below is additive on top of the existing Cloud database, auth, roles, RLS, Bunny playback, and TanStack Start routing.

## Gap analysis (current state)

| Area | Today | Action |
| --- | --- | --- |
| Auth, approved viewers, admin roles | Built | Preserve, extend roles |
| Video library, collections, search, watch, playlists, history, shares, comments, notifications bell | Built | Keep; extend search + media metadata |
| Series, nested categories, file assets | Missing (flat collections only) | Add |
| Plugin system, dynamic nav, plugin settings | Missing | Add (foundation) |
| Hymnal, Services, Running order, Rotas | Missing | Add |
| Events, Forms, Prayer wall, Small groups, Announcements | Missing | Add |
| Unified notifications (email/SMS/push), TV display, Spanish | Partial (in-app notifications only) | Add |
| Permissions beyond admin/viewer | Missing | Add role + permission model |

## Phase 1 — Plugin framework and permissions (foundation)

- Tables: `plugins` (id, name, group, description, icon, enabled, settings jsonb), `role_permissions` (role, permission), extend `app_role` with `staff`, `volunteer`, `member`.
- Central registry `src/lib/plugins/registry.ts`: one entry per module with id, group, nav entries, permissions, admin + public routes.
- Server guard `requirePlugin(id)` + `requirePermission(perm)` used by every new server function — disabled plugin means server-side 403, not just hidden UI.
- `/admin/plugins` page: toggle modules by group. Disabling hides nav, blocks routes and server functions, keeps all data.
- Navigation rebuilt from the registry (desktop + mobile drawer). No hard-coded per-feature checks.

## Phase 2 — Media and search improvements

- Add `series`, nested `collections.parent_id`, `media_files` (documents/PDF/audio), publish flag, ordering, richer description/metadata.
- Unified search across enabled plugin content types with type filters; disabled plugins excluded server-side.

## Phase 3 — Worship

- Hymnal: number, title, lyrics, author, composer, category, notes, OCR/search text, scan attachment; public browse by number/alphabet + admin CRUD.
- Services: title, date, times, location, notes; running-order items (song, hymn, scripture, prayer, sermon, announcement, video, offering, communion, custom) with reordering.
- Rotas: people, roles, dates, linked service/event, availability, confirmation; list + calendar views.

## Phase 4 — Church

- Events with registration, capacity, deadline, custom fields, attendance.
- Reusable form builder (all field types, validation, submissions viewer, CSV export) reused by events and any other form need.
- Prayer wall with moderation and answered state.
- Small groups directory with public discovery.
- Announcements with priority, pinning, audience, expiry, surfaced on dashboard and public pages.

## Phase 5 — Communication, display, localization

- Notification hub: in-app (existing) plus optional email/SMS/web push. Unconfigured channels show "Not configured" with setup requirements — never fake, never crash.
- TV display mode: chrome-free full-screen rotation of announcements, upcoming events, current service item, scripture, images.
- Spanish localization layer for UI strings, wired to the existing per-device language setting.

## Phase 6 — Hardening

- Admin dashboard widgets driven by enabled plugins (moderation queue, upcoming services, rota gaps, submissions, media stats).
- RLS audit across new and existing tables, server-side permission checks, mobile pass on admin tables/rotas/forms, accessibility and performance pass.

## Technical notes

- Every new table: FKs, indexes, timestamps, GRANTs, RLS with permission-based policies via security-definer helpers (`has_permission`, `plugin_enabled`).
- All CRUD goes through `createServerFn` with auth middleware; no client-trusted permissions.
- UI reuses existing shadcn components, tokens, gradients, and layout conventions.

## Delivery

Phases ship in order, each one functional end to end (persistence, CRUD, validation, authorization, loading/error/empty states, mobile) before the next starts.
