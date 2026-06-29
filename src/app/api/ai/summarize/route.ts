import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SummarizeSchema = z.object({
  content: z.string().min(10, 'Document too short').max(20000, 'Document too long'),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SummarizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: `You are a helpful writing assistant. Summarize documents clearly and concisely using this format:
**Overview:** One sentence summary.
**Key Points:**
- Point 1
- Point 2
- Point 3
**Tone:** Describe the writing tone in a few words.`,
        },
        {
          role: 'user',
          content: `Please summarize this document:\n\n${parsed.data.content}`,
        },
      ],
    });

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) {
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err: any) {
    console.error('OpenAI error:', err?.message);
    return NextResponse.json(
      { error: 'AI request failed: ' + (err?.message ?? 'Unknown error') },
      { status: 500 }
    );
  }
}