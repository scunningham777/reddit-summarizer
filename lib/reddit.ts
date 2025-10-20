import { Buffer } from 'node:buffer';

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
                'User-Agent': 'RedditSummarizer/1.0'
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
