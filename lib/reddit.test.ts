import { Buffer } from 'node:buffer';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { normalizeRedditUrl, resolveShareUrlIfNeeded } from './reddit';

describe('normalizeRedditUrl()', () => {
  it('appends .json when missing', () => {
    expect(normalizeRedditUrl('https://reddit.com/r/test/comments/abc123'))
      .toBe('https://reddit.com/r/test/comments/abc123.json');
  });

  it('drops query parameters', () => {
    expect(
      normalizeRedditUrl('https://reddit.com/r/test/comments/abc123?utm=123')
    ).toBe('https://reddit.com/r/test/comments/abc123.json');
  });

  it('handles trailing slash and fragment', () => {
    expect(
      normalizeRedditUrl('https://reddit.com/r/test/comments/abc123/#foo')
    ).toBe('https://reddit.com/r/test/comments/abc123.json');
  });

  it('does not duplicate .json', () => {
    expect(
      normalizeRedditUrl('https://reddit.com/r/test/comments/abc123.json?x=1')
    ).toBe('https://reddit.com/r/test/comments/abc123.json');
  });

  it('resolves share links with encoded path token', () => {
    const path = '/r/test/comments/abc123';
    const token = Buffer.from(path)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(
      normalizeRedditUrl(`https://www.reddit.com${path}/s/${token}?utm_source=share`)
    ).toBe('https://www.reddit.com/r/test/comments/abc123.json');
  });

  it('resolves share links whose token wraps JSON payload', () => {
    const payload = JSON.stringify({ path: '/r/test/comments/def456' });
    const token = Buffer.from(payload)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(
      normalizeRedditUrl(`https://www.reddit.com/r/test/comments/def456/s/${token}`)
    ).toBe('https://www.reddit.com/r/test/comments/def456.json');
  });
});

describe('resolveShareUrlIfNeeded()', () => {
  beforeEach(() => {
    process.env.REDDIT_CLIENT_ID = 'test-client';
    process.env.REDDIT_CLIENT_SECRET = 'test-secret';
    process.env.REDDIT_USER_AGENT = 'test-agent/1.0';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns redirected location for share links', async () => {
    const shareUrl = 'https://www.reddit.com/r/example/s/token';
    const redirectLocation = 'https://www.reddit.com/r/example/comments/abc123/?utm_source=share';
    const mockFetch = vi.fn().mockImplementation(async (input: any, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/v1/access_token')) {
        expect(init?.method).toBe('POST');
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      expect(url).toBe(shareUrl);
      expect(init?.redirect).toBe('manual');

      return new Response(null, {
        status: 301,
        headers: { location: redirectLocation }
      });
    });

    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch);

    const resolved = await resolveShareUrlIfNeeded(shareUrl);

    expect(resolved).toBe(redirectLocation);
  });

  it('resolves relative redirect targets', async () => {
    const shareUrl = 'https://www.reddit.com/r/example2/s/token2';
    const relativeLocation = '/r/example2/comments/def456/';
    const mockFetch = vi.fn().mockImplementation(async (input: any, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/v1/access_token')) {
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      expect(url).toBe(shareUrl);

      return new Response(null, {
        status: 302,
        headers: { location: relativeLocation }
      });
    });

    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch);

    const resolved = await resolveShareUrlIfNeeded(shareUrl);

    expect(resolved).toBe('https://www.reddit.com/r/example2/comments/def456/');
  });

  it('returns null when redirect response is missing location header', async () => {
    const shareUrl = 'https://www.reddit.com/r/example3/s/token3';
    const mockFetch = vi.fn().mockImplementation(async (input: any, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/v1/access_token')) {
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      expect(url).toBe(shareUrl);

      return new Response(null, { status: 301 });
    });

    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch);

    const resolved = await resolveShareUrlIfNeeded(shareUrl);

    expect(resolved).toBeNull();
  });
});