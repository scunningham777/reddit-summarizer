import { Buffer } from 'node:buffer';

export const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT ?? 'RedditSummarizer/1.0';

interface CachedToken {
    token: string;
    expiresAt: number;
}

let cachedAccessToken: CachedToken | null = null;

export async function getRedditAccessToken(): Promise<string> {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Missing Reddit client credentials. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET.');
    }

    const now = Date.now();
    if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
        return cachedAccessToken.token;
    }

    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': REDDIT_USER_AGENT
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' })
    });

    if (!tokenResponse.ok) {
        const body = await tokenResponse.text();
        throw new Error(`Failed to obtain Reddit access token: ${tokenResponse.status} ${body.slice(0, 200)}`);
    }

    const tokenJson: { access_token?: string; expires_in?: number } = await tokenResponse.json();
    if (!tokenJson.access_token) {
        throw new Error('Reddit access token response missing access_token.');
    }

    const expiresInSeconds = Math.max((tokenJson.expires_in ?? 0) - 60, 0); // refresh 60s early
    cachedAccessToken = {
        token: tokenJson.access_token,
        expiresAt: now + expiresInSeconds * 1000
    };

    return tokenJson.access_token;
}

export async function fetchRedditJson(url: string, init: RequestInit = {}): Promise<Response> {
    const accessToken = await getRedditAccessToken();

    const apiUrl = new URL(url);
    apiUrl.hostname = 'oauth.reddit.com';
    apiUrl.port = '';
    apiUrl.searchParams.set('raw_json', '1');

    const headers = new Headers(init.headers ?? {});
    headers.set('User-Agent', REDDIT_USER_AGENT);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Accept', 'application/json');

    const mergedInit: RequestInit = {
        ...init,
        headers
    };

    return fetch(apiUrl, mergedInit);
}

export function normalizeRedditUrl(inputUrl: string): string {
    const trimmed = inputUrl.trim();

    const appendJson = (baseUrl: string) =>
        baseUrl.endsWith('.json') ? baseUrl : `${baseUrl}.json`;

    try {
        const parsed = new URL(trimmed);

        const shareToken = extractShareToken(parsed.pathname);
        if (shareToken) {
            const decoded = decodeShareToken(shareToken);
            if (decoded) {
                const resolved = resolveDecodedSharePath(parsed, decoded);
                if (resolved) {
                    return appendJson(resolved);
                }
            }
        }

        const base = `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
        return appendJson(base || parsed.origin);
    } catch {
        const withoutQuery = trimmed.split('#')[0]?.split('?')[0] ?? trimmed;
        const withoutTrailingSlash = withoutQuery.replace(/\/$/, '');
        return appendJson(withoutTrailingSlash);
    }
}

function extractShareToken(pathname: string): string | null {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length < 4) {
        return null;
    }

    const sIndex = segments.indexOf('s');
    if (segments[0] !== 'r' || sIndex === -1 || sIndex !== segments.length - 2) {
        return null;
    }

    return segments[sIndex + 1] ?? null;
}

function decodeShareToken(token: string): string | null {
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padding);

    try {
        const decodedBuffer = Buffer.from(padded, 'base64');
        const decodedString = decodedBuffer.toString('utf-8');

        try {
            const parsed = JSON.parse(decodedString);
            if (parsed && typeof parsed === 'object') {
                if (typeof parsed.path === 'string') {
                    return parsed.path;
                }
                if (typeof parsed.url === 'string') {
                    return parsed.url;
                }
            }
        } catch {
            // Not JSON, fall back to raw string handling
        }

        if (decodedString.startsWith('http')) {
            return decodedString;
        }

        if (decodedString.startsWith('/')) {
            return decodedString;
        }

        if (decodedString.startsWith('r/')) {
            return `/${decodedString}`;
        }
    } catch {
        // Ignore decoding errors and allow fallback logic
    }

    return null;
}

function resolveDecodedSharePath(originalUrl: URL, decoded: string): string | null {
    let sanitized = decoded.trim();
    sanitized = sanitized.split('#')[0] ?? sanitized;
    sanitized = sanitized.split('?')[0] ?? sanitized;
    sanitized = sanitized.replace(/\/$/, '').replace(/\.json$/, '');

    try {
        const resolvedUrl = new URL(sanitized);
        return `${resolvedUrl.origin}${resolvedUrl.pathname}`;
    } catch {
        if (sanitized.startsWith('/')) {
            return `${originalUrl.origin}${sanitized}`;
        }

        return `${originalUrl.origin}/${sanitized}`;
    }
}

export async function resolveShareUrlIfNeeded(url: string): Promise<string | null> {
    try {
        const parsed = new URL(url);
        const segments = parsed.pathname.split('/').filter(Boolean);
        const sIndex = segments.indexOf('s');
        if (segments[0] !== 'r' || sIndex === -1 || sIndex !== segments.length - 2) {
            return null;
        }

        const response = await fetch(parsed.toString(), {
            method: 'GET',
            redirect: 'manual',
            headers: {
                'User-Agent': REDDIT_USER_AGENT
            }
        });

        if (response.status < 300 || response.status >= 400) {
            return null;
        }

        const location = response.headers.get('location');
        if (!location) {
            return null;
        }

        const resolved = new URL(location, parsed);
        return resolved.toString();
    } catch {
        return null;
    }
}
