'use client';
import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Reddit Thread Summarizer</h1>
      <form onSubmit={handleSubmit} className="mb-8">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste Reddit thread URL..."
          className="w-full p-4 border border-gray-300 rounded"
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
        >
          {loading ? 'Summarizing...' : 'Summarize Thread'}
        </button>
      </form>
      {loading && <p>Loading...</p>}
      {summary && (
        <div className="bg-gray-100 p-6 rounded text-black">
          <pre className="whitespace-pre-wrap">{JSON.stringify(summary, null, 2)}</pre>
        </div>
      )}
    </main>
  );
}