import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { documents, documentVersions, documentMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import * as Y from 'yjs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; vId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, vId } = await params;
  const userId = (session.user as any).id;

  const membership = await db.query.documentMembers.findFirst({
    where: and(
      eq(documentMembers.documentId, id),
      eq(documentMembers.userId, userId)
    ),
  });

  if (!membership || membership.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const version = await db.query.documentVersions.findFirst({
    where: and(
      eq(documentVersions.id, vId),
      eq(documentVersions.documentId, id)
    ),
  });

  if (!version?.yjsState) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }
  const currentDoc = await db.query.documents.findFirst({
    where: eq(documents.id, id),
  });

  if (currentDoc?.yjsState) {
    await db.insert(documentVersions).values({
      documentId: id,
      createdBy: userId,
      label: `Auto-save before restoring "${version.label}"`,
      yjsState: currentDoc.yjsState,
    });
  }

  const targetDoc = new Y.Doc();
  Y.applyUpdate(
    targetDoc,
    new Uint8Array(Buffer.from(version.yjsState, 'base64'))
  );
  const restoredState = Buffer.from(
    Y.encodeStateAsUpdate(targetDoc)
  ).toString('base64');

  await db
    .update(documents)
    .set({ yjsState: restoredState, updatedAt: new Date() })
    .where(eq(documents.id, id));

  return NextResponse.json({ ok: true });
}