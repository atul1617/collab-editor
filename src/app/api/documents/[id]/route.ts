import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { documents, documentMembers, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

async function getDbUserId(session: any): Promise<string | null> {
  const email = session?.user?.email;
  if (!email) return null;
  const dbUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  return dbUser?.id ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const userId = await getDbUserId(session);
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const membership = await db.query.documentMembers.findFirst({
    where: and(eq(documentMembers.documentId, id), eq(documentMembers.userId, userId)),
  });

  if (!membership) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, id),
  });

  return NextResponse.json({ ...doc, role: membership.role });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const userId = await getDbUserId(session);
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();

  const membership = await db.query.documentMembers.findFirst({
    where: and(eq(documentMembers.documentId, id), eq(documentMembers.userId, userId)),
  });

  if (!membership || membership.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [updated] = await db
    .update(documents)
    .set({ title: body.title, updatedAt: new Date() })
    .where(eq(documents.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const userId = await getDbUserId(session);
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const membership = await db.query.documentMembers.findFirst({
    where: and(eq(documentMembers.documentId, id), eq(documentMembers.userId, userId)),
  });

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.delete(documents).where(eq(documents.id, id));
  return NextResponse.json({ ok: true });
}