'use client';

import { SyncProvider } from '@/lib/sync/SyncContext';
import { Editor, EditorHandle } from '@/components/editor/Editor';
import { ConnectionStatus } from '@/components/editor/ConnectionStatus';
import { VersionHistory } from '@/components/editor/VersionHistory';
import { AISidebar } from '@/components/ai/AISidebar';
import { ShareModal } from '@/components/editor/ShareModal';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useState, useCallback, useRef } from 'react';

interface EditorClientProps {
  documentId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  userName: string;
}

export function EditorClient({
  documentId,
  userId,
  role,
  userName,
}: EditorClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState('Untitled Document');
  const [key, setKey] = useState(0);
  const editorRef = useRef<EditorHandle>(null);
  const authToken = (session as any)?.accessToken ?? 'local';

  const handleRestore = useCallback(() => setKey((k) => k + 1), []);

  return (
    <SyncProvider
      documentId={documentId}
      userId={userId}
      role={role}
      authToken={authToken}
    >
      <div className="min-h-screen bg-white flex flex-col">
        <header className="border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={async () => {
                await fetch(`/api/documents/${documentId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title }),
                });
              }}
              disabled={role === 'viewer'}
              className="text-lg font-semibold text-gray-900 bg-transparent border-none outline-none focus:bg-gray-50 rounded px-2 py-1 disabled:cursor-default"
            />
          </div>

          <div className="flex items-center gap-3">
            <ConnectionStatus />
            <VersionHistory documentId={documentId} onRestore={handleRestore} />
            {role !== 'viewer' && (
              <AISidebar
                getContent={() => editorRef.current?.getContent() ?? ''}
                getSelection={() => editorRef.current?.getSelection() ?? ''}
                onInsert={(text) => editorRef.current?.insertText(text)}
              />
            )}
            <ShareModal
              documentId={documentId}
              currentUserId={userId}
              currentUserRole={role}
            />
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full capitalize">
              {role}
            </span>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full py-8 px-4">
          <Editor key={key} ref={editorRef} />
        </main>

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
          Built by{' '}
          <a href="https://github.com/yourusername" className="underline" target="_blank">
            Your Name
          </a>{' '}
          ·{' '}
          <a href="https://linkedin.com/in/yourusername" className="underline" target="_blank">
            LinkedIn
          </a>
        </footer>
      </div>
    </SyncProvider>
  );
}