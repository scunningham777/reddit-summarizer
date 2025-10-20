import { normalizeRedditUrl, resolveShareUrlIfNeeded } from '@/lib/reddit';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface RedditComment {
    author: string;
    body: string;
    score: number;
}

export async function POST(request: NextRequest) {
    const { url } = await request.json();

    const resolvedShareUrl = await resolveShareUrlIfNeeded(url);
    const effectiveUrl = resolvedShareUrl ?? url;
    const jsonUrl = normalizeRedditUrl(effectiveUrl);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing OpenAI API key' }, { status: 500 });
    }
    const openai = new OpenAI({ apiKey });

    try {
        // Fetch Reddit thread data
        const response = await fetch(jsonUrl, {
            headers: {
                'User-Agent': 'RedditSummarizer/1.0'
            }
        });

        const data = await response.json();

        // Extract post and comments
        const post = data[0].data.children[0].data;
        const comments = extractComments(data[1].data.children);

        const commentText = comments
            .slice(0, 10)
            .map((comment, index) => `Comment ${index + 1} by ${comment.author} (score ${comment.score}): ${comment.body}`)
            .join('\n\n');

        const userContent = [
            `Post title: ${post.title}`,
            post.selftext ? `Post body: ${post.selftext}` : null,
            commentText ? `Top comments:\n${commentText}` : null,
            'Provide a concise summary (3 sentences max).' 
        ]
            .filter(Boolean)
            .join('\n\n');

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You summarize Reddit discussions into concise briefs.' },
                { role: 'user', content: userContent }
            ],
            temperature: 0.6
        });

        const messageContent = completion.choices[0]?.message?.content;
        const summary = Array.isArray(messageContent)
            ? messageContent
                  .map((part) =>
                      typeof part === 'string'
                          ? part
                          : typeof part === 'object' && part !== null && 'text' in part
                          ? (part as { text?: string }).text ?? ''
                          : ''
                  )
                  .join('')
            : messageContent ?? '';

        return NextResponse.json({
            title: post.title,
            author: post.author,
            selftext: post.selftext,
            commentCount: comments.length,
            topComments: comments.slice(0, 10),
            summary
        })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch Reddit thread data' }, { status: 500 });
    }
}

function extractComments(commentTree: any[]): RedditComment[] {
    const comments: RedditComment[] = [];
    
    commentTree.forEach((node: any) => {
        if (node.kind === 't1') {   // t1 = comment
            const comment = node.data;
            if (comment.body && comment.body !== '[deleted]') {
                comments.push({
                    author: comment.author,
                    body: comment.body,
                    score: comment.score
                })
            }
        }
    });

    return comments;
}
