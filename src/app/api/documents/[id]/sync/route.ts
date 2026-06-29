import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { documents, documentMembers, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as Y from 'yjs';

const MAX_PAYLOAD_BYTES = 512 * 1024;

const SyncPayloadSchema = z.object({
  update: z
    .string()
    .max(700_000, 'Payload too large')
    .regex(/^[A-Za-z0-9+/=]+$/, 'Invalid base64'),
  clientClock: z.number().int().nonneg(),
  userId: z.string(),
});

async function getDbUserId(session: any): Promise<string | null> {
  const email = session?.user?.email;
  if (!email) return null;
  const dbUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  return dbUser?.id ?? null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const contentLength = parseInt(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const userId = await getDbUserId(session);
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const membership = await db.query.documentMembers.findFirst({
    where: and(eq(documentMembers.documentId, id), eq(documentMembers.userId, userId)),
  });

  if (!membership || membership.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SyncPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  let updateBytes: Uint8Array;
  try {
    updateBytes = new Uint8Array(Buffer.from(parsed.data.update, 'base64'));
    const testDoc = new Y.Doc();
    Y.applyUpdate(testDoc, updateBytes);
  } catch {
    return NextResponse.json({ error: 'Malformed CRDT update' }, { status: 422 });
  }

  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, id),
  });

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const serverDoc = new Y.Doc();
  if (doc.yjsState) {
    Y.applyUpdate(serverDoc, new Uint8Array(Buffer.from(doc.yjsState, 'base64')));
  }
  Y.applyUpdate(serverDoc, updateBytes);

  const newState = Buffer.from(Y.encodeStateAsUpdate(serverDoc)).toString('base64');

  await db
    .update(documents)
    .set({ yjsState: newState, updatedAt: new Date() })
    .where(eq(documents.id, id));

  return NextResponse.json({ ok: true });
}