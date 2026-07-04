// bunny.net Stream API helpers. Server-only — .server.ts extension prevents
// client bundling. Signed tokens are generated fresh on every request.

import { createHash, createHmac, randomBytes } from "crypto";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const BUNNY_BASE = "https://video.bunnycdn.com";

async function bunnyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const libraryId = env("BUNNY_LIBRARY_ID");
  const apiKey = env("BUNNY_API_KEY");
  const res = await fetch(`${BUNNY_BASE}/library/${libraryId}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      AccessKey: apiKey,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`bunny.net ${res.status}: ${body.slice(0, 300)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface BunnyVideo {
  guid: string;
  title: string;
  status: number; // 0-4 uploading/processing/finished etc.
  encodeProgress: number;
  length: number; // seconds
  views: number;
  thumbnailFileName?: string;
  dateUploaded: string;
  collectionId?: string;
}

export interface BunnyListResponse {
  items: BunnyVideo[];
  totalItems: number;
}

export async function bunnyListVideos(opts?: {
  page?: number;
  itemsPerPage?: number;
  search?: string;
  collectionId?: string;
  orderBy?: string;
}): Promise<BunnyListResponse> {
  const params = new URLSearchParams();
  params.set("page", String(opts?.page ?? 1));
  params.set("itemsPerPage", String(opts?.itemsPerPage ?? 100));
  if (opts?.search) params.set("search", opts.search);
  if (opts?.collectionId) params.set("collection", opts.collectionId);
  if (opts?.orderBy) params.set("orderBy", opts.orderBy);
  return bunnyFetch<BunnyListResponse>(`/videos?${params.toString()}`);
}

export async function bunnyGetVideo(guid: string): Promise<BunnyVideo> {
  return bunnyFetch<BunnyVideo>(`/videos/${encodeURIComponent(guid)}`);
}

export async function bunnyCreateVideo(title: string, collectionId?: string): Promise<BunnyVideo> {
  return bunnyFetch<BunnyVideo>(`/videos`, {
    method: "POST",
    body: JSON.stringify({ title, ...(collectionId ? { collectionId } : {}) }),
  });
}

export async function bunnyUpdateVideo(
  guid: string,
  patch: { title?: string; collectionId?: string },
): Promise<void> {
  await bunnyFetch(`/videos/${encodeURIComponent(guid)}`, {
    method: "POST",
    body: JSON.stringify(patch),
  });
}

export async function bunnyDeleteVideo(guid: string): Promise<void> {
  await bunnyFetch(`/videos/${encodeURIComponent(guid)}`, { method: "DELETE" });
}

// Signed embed token — used by /embed/{lib}/{video}?token=...&expires=...
// Bunny signature: SHA256(tokenKey + videoId + expires)
export function bunnySignedEmbedUrl(videoId: string, ttlSeconds = 4 * 3600): string {
  const libraryId = env("BUNNY_LIBRARY_ID");
  const tokenKey = env("BUNNY_TOKEN_AUTH_KEY");
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const hash = createHash("sha256").update(tokenKey + videoId + expires).digest("hex");
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${encodeURIComponent(videoId)}?token=${hash}&expires=${expires}&autoplay=false`;
}

// Signed thumbnail URL (pull zone token). Uses BUNNY_CDN_TOKEN_KEY if set,
// otherwise BUNNY_TOKEN_AUTH_KEY. If BUNNY_CDN_HOSTNAME is missing, returns null.
export function bunnySignedThumbnailUrl(videoId: string, ttlSeconds = 3600): string | null {
  const host = process.env.BUNNY_CDN_HOSTNAME;
  if (!host) return null;
  const tokenKey = process.env.BUNNY_CDN_TOKEN_KEY || process.env.BUNNY_TOKEN_AUTH_KEY;
  const path = `/${videoId}/thumbnail.jpg`;
  const url = `https://${host}${path}`;
  if (!tokenKey) return url; // no token auth on pull zone
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const raw = tokenKey + path + expires;
  const token = Buffer.from(createHash("sha256").update(raw).digest())
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${url}?token=${token}&expires=${expires}`;
}

// TUS upload signing. Bunny expects headers:
// AuthorizationSignature = SHA256(libraryId + apiKey + expiration + videoId)
// AuthorizationExpire, LibraryId, VideoId
export function bunnyTusSignature(videoId: string, ttlSeconds = 3600) {
  const libraryId = env("BUNNY_LIBRARY_ID");
  const apiKey = env("BUNNY_API_KEY");
  const expiration = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = createHash("sha256")
    .update(String(libraryId) + apiKey + String(expiration) + videoId)
    .digest("hex");
  return {
    endpoint: "https://video.bunnycdn.com/tusupload",
    libraryId,
    videoId,
    expiration,
    signature,
  };
}

// Collections
export interface BunnyCollection { guid: string; name: string; videoCount: number; }
export async function bunnyListCollections(): Promise<{ items: BunnyCollection[] }> {
  return bunnyFetch(`/collections?itemsPerPage=200`);
}
export async function bunnyCreateCollection(name: string): Promise<BunnyCollection> {
  return bunnyFetch<BunnyCollection>(`/collections`, { method: "POST", body: JSON.stringify({ name }) });
}
export async function bunnyDeleteCollection(guid: string): Promise<void> {
  await bunnyFetch(`/collections/${encodeURIComponent(guid)}`, { method: "DELETE" });
}

// Statistics
export async function bunnyStatistics(): Promise<{
  viewsChart: Record<string, number>;
  watchTimeChart: Record<string, number>;
  countryViewCounts: Record<string, number>;
  totalWatchTime: number;
  totalViewCount: number;
  averageWatchTime: number;
  engagementScore: number;
}> {
  return bunnyFetch(`/statistics`);
}

export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

// HMAC-verify signature helper (unused externally, exported for tests)
export function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  // Prefer crypto.timingSafeEqual (constant time)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { timingSafeEqual } = require("crypto") as typeof import("crypto");
  return timingSafeEqual(A, B);
}
export const _hmacSha256 = createHmac;
