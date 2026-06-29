import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { documentMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { EditorClient } from './EditorClient';

export default async function DocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const { id } = await params;

  const membership = await db.query.documentMembers.findFirst({
    where: and(
      eq(documentMembers.documentId, id),
      eq(documentMembers.userId, (session.user as any).id)
    ),
  });

  if (!membership) redirect('/dashboard');

  return (
    <EditorClient
      documentId={id}
      userId={(session.user as any).id}
      role={membership.role as 'owner' | 'editor' | 'viewer'}
      userName={session.user.name ?? 'Anonymous'}
    />
  );
}