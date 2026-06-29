'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FileText, Plus, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

interface Doc {
  id: string;
  title: string;
  role: string;
  updatedAt: string;
}

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function DashboardClient({ user }: { user: User }) {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

 useEffect(() => {
  fetch('/api/documents')
    .then(async (r) => {
      const text = await r.text();
      if (!text) return [];
      return JSON.parse(text);
    })
    .then((data) => {
      setDocs(Array.isArray(data) ? data : []);
      setLoading(false);
    })
    .catch((err) => {
      console.error('Failed to load documents:', err);
      setDocs([]);
      setLoading(false);
    });
}, []);

const createDocument = async () => {
  setCreating(true);
  try {
    const res = await fetch('/api/documents', { method: 'POST' });
    const text = await res.text();
    console.log('Server response status:', res.status);
    console.log('Server response body:', text);
    if (!text) throw new Error('Empty response');
    const doc = JSON.parse(text);
    if (doc.error) throw new Error(doc.error);
    router.push(`/docs/${doc.id}`);
  } catch (err) {
    console.error('Failed to create document:', err);
    setCreating(false);
  }
};

  return (
    <div className="min-h-screen bg-gray-50">
   
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Collab Editor</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="h-4 w-4 mr-1" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">My Documents</h2>
          <Button onClick={createDocument} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" />
            {creating ? 'Creating…' : 'New Document'}
          </Button>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No documents yet.</p>
            <p className="text-gray-400 text-sm mt-1">
              Click "New Document" to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {docs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => router.push(`/docs/${doc.id}`)}
                className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex items-center justify-between cursor-pointer hover:border-gray-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{doc.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full capitalize">
                  {doc.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100 mt-10">
        Built by{' '}
        <a href="https://github.com/yourusername" className="underline hover:text-gray-600" target="_blank">
          Your Name
        </a>{' '}
        ·{' '}
        <a href="https://linkedin.com/in/yourusername" className="underline hover:text-gray-600" target="_blank">
          LinkedIn
        </a>
      </footer>
    </div>
  );
}