'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import { useSyncEngine } from '@/lib/sync/SyncContext';
import { useEffect, useImperativeHandle, forwardRef } from 'react';

export interface EditorHandle {
  getContent: () => string;
  getSelection: () => string;
  insertText: (text: string) => void;
}

interface EditorProps {
  onContentChange?: (text: string) => void;
}

function EditorInner({ onContentChange, ref }: EditorProps & { ref: any }) {
  const { ydoc, role } = useSyncEngine();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc! }),
    ],
    editable: role !== 'viewer',
    editorProps: {
      attributes: {
        class:
          'prose prose-gray max-w-none min-h-[500px] focus:outline-none px-8 py-6',
      },
    },
    onUpdate: ({ editor }) => {
      onContentChange?.(editor.getText());
    },
  });

  useImperativeHandle(ref, () => ({
    getContent: () => editor?.getText() ?? '',
    getSelection: () => {
      if (!editor) return '';
      const { from, to } = editor.state.selection;
      return editor.state.doc.textBetween(from, to, ' ');
    },
    insertText: (text: string) => {
      editor?.chain().focus().insertContent(text).run();
    },
  }));

  useEffect(() => {
    if (editor) editor.setEditable(role !== 'viewer');
  }, [editor, role]);

  return (
    <div className="w-full">
      {role !== 'viewer' && editor && (
        <div className="flex gap-1 p-2 border-b border-gray-200 flex-wrap">
          {[
            { label: 'B', title: 'Bold', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
            { label: 'I', title: 'Italic', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
            { label: 'H1', title: 'Heading 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
            { label: 'H2', title: 'Heading 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
            { label: '• List', title: 'Bullet List', action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
            { label: '1. List', title: 'Ordered List', action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
            { label: '<>', title: 'Code Block', action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock') },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              title={btn.title}
              className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                btn.active
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

export const Editor = forwardRef<EditorHandle, EditorProps>(
  (props, ref) => {
    const { ydoc } = useSyncEngine();

    if (!ydoc) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
            <p className="text-sm">Loading document…</p>
          </div>
        </div>
      );
    }

    return <EditorInner {...props} ref={ref} />;
  }
);

Editor.displayName = 'Editor';