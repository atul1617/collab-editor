import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { documentVersions, documentMembers } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const VersionPayloadSchema = z.object({
  label: z.string().min(1).max(100),
  yjsState: z
    .string()
    .max(700_000)
    .regex(/^[A-Za-z0-9+/=]+$/, 'Invalid base64'),
});

// GET /api/documents/:id/versions — list all versions
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

  // Check user has access to this document
  const membership = await db.query.documentMembers.findFirst({
    where: and(
      eq(documentMembers.documentId, id),
      eq(documentMembers.userId, userId)
    ),
  });

  if (!membership) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Return versions newest first
  const versions = await db.query.documentVersions.findMany({
    where: eq(documentVersions.documentId, id),
    orderBy: [desc(documentVersions.createdAt)],
  });

  return NextResponse.json(versions);
}

// POST /api/documents/:id/versions — save a new snapshot
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

  // Only owners and editors can save versions
  const membership = await db.query.documentMembers.findFirst({
    where: and(
      eq(documentMembers.documentId, id),
      eq(documentMembers.userId, userId)
    ),
  });

  if (!membership || membership.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = VersionPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const [version] = await db
    .insert(documentVersions)
    .values({
      documentId: id,
      createdBy: userId,
      label: parsed.data.label,
      yjsState: parsed.data.yjsState,
    })
    .returning();

  return NextResponse.json(version);
}