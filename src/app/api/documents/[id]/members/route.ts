import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { documentMembers, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const InviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['editor', 'viewer']),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as any).id;

  const membership = await db.query.documentMembers.findFirst({
    where: and(
      eq(documentMembers.documentId, id),
      eq(documentMembers.userId, userId)
    ),
  });

  if (!membership) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const members = await db
    .select({
      id: documentMembers.id,
      role: documentMembers.role,
      userId: documentMembers.userId,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(documentMembers)
    .leftJoin(users, eq(documentMembers.userId, users.id))
    .where(eq(documentMembers.documentId, id));

  return NextResponse.json(members);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as any).id;

  const membership = await db.query.documentMembers.findFirst({
    where: and(
      eq(documentMembers.documentId, id),
      eq(documentMembers.userId, userId)
    ),
  });

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can invite members' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const invitedUser = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  });

  if (!invitedUser) {
    return NextResponse.json(
      { error: 'User not found. They must sign in to Collab Editor first.' },
      { status: 404 }
    );
  }

  if (invitedUser.id === userId) {
    return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 });
  }

  const existing = await db.query.documentMembers.findFirst({
    where: and(
      eq(documentMembers.documentId, id),
      eq(documentMembers.userId, invitedUser.id)
    ),
  });

  if (existing) {
    return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
  }

  const [newMember] = await db
    .insert(documentMembers)
    .values({
      documentId: id,
      userId: invitedUser.id,
      role: parsed.data.role,
    })
    .returning();

  return NextResponse.json({ ...newMember, name: invitedUser.name, email: invitedUser.email });
}