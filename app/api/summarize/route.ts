import { NextRequest, NextResponse } from 'next/server';

interface RedditComment {
    author: string;
    body: string;
    score: number;
}

export async function POST(request: NextRequest) {
    const { url } = await request.json();

    // Convert Reddit URL to JSON endpoint
    // https://reddit.com/r/example/comments/abc123 -> https://reddit.com/r/example/comments/abc123.json
    const jsonUrl = url.endsWith('.json') ? url : `${url}.json`;
    
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

        // For now, return raw data
        return NextResponse.json({
            title: post.title,
            author: post.author,
            selftext: post.selftext,
            commentCount: comments.length,
            topComments: comments.slice(0, 10)
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
