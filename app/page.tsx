'use client';
import { useState } from 'react';

type SummaryResponse = {
  title: string;
  author: string;
  selftext?: string;
  commentCount: number;
  topComments: {
    author: string;
    body: string;
    score: number;
  }[];
  summary: string;
  error?: string;
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSummary(null);

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data?.error ?? 'Failed to summarize thread.');
        return;
      }
      setSummary(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(124,_58,_237,_0.08),_transparent_55%)]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16">
        <header className="mb-12">
          <h1 className="text-4xl font-semibold tracking-tight">Reddit Thread Summarizer</h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-200">
            Paste any Reddit thread URL and get a concise AI summary with key context and top community insights.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-[rgba(27,22,54,0.75)] p-8 shadow-[0_25px_60px_-25px_rgba(76,29,149,0.65)] backdrop-blur">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-gray-300" htmlFor="thread-url">
              Reddit thread URL
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="thread-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.reddit.com/r/..."
                className="w-full rounded-lg border border-purple-300/30 bg-slate-950/70 px-4 py-3 text-white shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-[#6d28d9] px-5 py-3 text-sm font-medium text-white shadow transition hover:bg-[#7e3af2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Summarizing…' : 'Summarize Thread'}
              </button>
            </div>
          </form>

          {loading && <p className="mt-6 text-sm text-gray-300">Analyzing thread…</p>}
          {errorMessage && <p className="mt-6 text-sm text-red-400">{errorMessage}</p>}

          {summary && (
            <div className="mt-10 space-y-8">
              <div className="rounded-xl border border-white/10 bg-[rgba(17,13,32,0.85)] p-6 shadow-inner">
                <h2 className="text-lg font-medium text-white">Summary</h2>
                <p className="mt-3 whitespace-pre-line text-sm text-gray-200">{summary.summary}</p>
              </div>

              <div className="grid gap-6 lg:grid-cols-5">
                <div className="rounded-xl border border-white/10 bg-[rgba(17,13,32,0.85)] p-6 lg:col-span-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Post snapshot</h3>
                  <p className="mt-3 text-lg font-semibold text-white">{summary.title}</p>
                  <p className="text-sm text-gray-400">by {summary.author}</p>
                  {summary.selftext && (
                    <p className="mt-3 whitespace-pre-line text-sm text-gray-300">{summary.selftext}</p>
                  )}
                  <p className="mt-4 text-xs text-gray-500">{summary.commentCount} comments analyzed</p>
                </div>

                {summary.topComments.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-[rgba(17,13,32,0.85)] p-6 lg:col-span-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Top comments</h3>
                    <ul className="mt-4 space-y-4">
                      {summary.topComments.slice(0, 5).map((comment, index) => (
                        <li key={index} className="rounded-lg border border-white/5 bg-white/10 p-4">
                          <p className="text-xs text-gray-400">{comment.author} • score {comment.score}</p>
                          <p className="mt-2 whitespace-pre-line text-sm text-gray-200">{comment.body}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}