import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { documentMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const UpdateSchema = z.object({
  role: z.enum(['editor', 'viewer']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, memberId } = await params;
  const userId = (session.user as any).id;

  const requesterMembership = await db.query.documentMembers.findFirst({
    where: and(
      eq(documentMembers.documentId, id),
      eq(documentMembers.userId, userId)
    ),
  });

  if (!requesterMembership || requesterMembership.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const targetMember = await db.query.documentMembers.findFirst({
    where: eq(documentMembers.id, memberId),
  });

  if (!targetMember) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
  }

  const [updated] = await db
    .update(documentMembers)
    .set({ role: parsed.data.role })
    .where(eq(documentMembers.id, memberId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, memberId } = await params;
  const userId = (session.user as any).id;

  const requesterMembership = await db.query.documentMembers.findFirst({
    where: and(
      eq(documentMembers.documentId, id),
      eq(documentMembers.userId, userId)
    ),
  });

  if (!requesterMembership || requesterMembership.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const targetMember = await db.query.documentMembers.findFirst({
    where: eq(documentMembers.id, memberId),
  });

  if (!targetMember) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 400 });
  }

  await db.delete(documentMembers).where(eq(documentMembers.id, memberId));

  return NextResponse.json({ ok: true });
}