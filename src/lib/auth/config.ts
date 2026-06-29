import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
     if (account && profile) {
        const email = token.email ?? (profile as any).email;
        const name = token.name ?? (profile as any).name;
        const image = token.picture ?? (profile as any).picture;

        if (email) {
          try {
           
            let dbUser = await db.query.users.findFirst({
              where: eq(users.email, email),
            });

            if (!dbUser) {
             
              const [created] = await db
                .insert(users)
                .values({ email, name, image })
                .returning();
              dbUser = created;
              console.log('Created new user:', dbUser.id);
            } else {
              console.log('Found existing user:', dbUser.id);
            }

            token.dbId = dbUser.id;
          } catch (err) {
            console.error('Failed to upsert user:', err);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.dbId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};