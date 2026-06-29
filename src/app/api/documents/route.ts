import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { documents, documentMembers, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

async function getDbUserId(session: any): Promise<string | null> {
  const email = session?.user?.email;
  if (!email) return null;

  const dbUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  return dbUser?.id ?? null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await getDbUserId(session);
    if (!userId) {
      return NextResponse.json([]);
    }

    const userDocs = await db
      .select({
        id: documents.id,
        title: documents.title,
        role: documentMembers.role,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documentMembers)
      .innerJoin(documents, eq(documents.id, documentMembers.documentId))
      .where(eq(documentMembers.userId, userId));

    return NextResponse.json(userDocs ?? []);
  } catch (err) {
    console.error('GET /api/documents error:', err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await getDbUserId(session);
    if (!userId) {
      return NextResponse.json(
        { error: 'User not found in database. Please sign out and sign in again.' },
        { status: 400 }
      );
    }

    const [newDoc] = await db
      .insert(documents)
      .values({
        title: 'Untitled Document',
        ownerId: userId,
      })
      .returning();

    await db.insert(documentMembers).values({
      documentId: newDoc.id,
      userId: userId,
      role: 'owner',
    });

    return NextResponse.json(newDoc);
  } catch (err) {
    console.error('POST /api/documents error:', err);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}