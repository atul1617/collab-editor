'use client';

import { useEffect, useState } from 'react';
import { useSyncEngine } from '@/lib/sync/SyncContext';
import { History, RotateCcw, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Version {
  id: string;
  label: string;
  createdAt: string;
  createdBy: string;
}

interface VersionHistoryProps {
  documentId: string;
  onRestore: () => void; 
}

export function VersionHistory({ documentId, onRestore }: VersionHistoryProps) {
  const { engine, role } = useSyncEngine();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [showInput, setShowInput] = useState(false);

  const fetchVersions = async () => {
    setLoading(true);
    const res = await fetch(`/api/documents/${documentId}/versions`);
    const data = await res.json();
    setVersions(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchVersions();
  }, [open]);

  const saveVersion = async () => {
    if (!label.trim() || !engine) return;
    setSaving(true);
    await engine.captureVersion(label.trim());
    setLabel('');
    setShowInput(false);
    await fetchVersions();
    setSaving(false);
  };

  const restoreVersion = async (vId: string) => {
    if (!confirm('Restore this version? Your current state will be auto-saved first.')) return;
    setRestoring(vId);
    await fetch(`/api/documents/${documentId}/versions/${vId}/restore`, {
      method: 'POST',
    });
    setRestoring(null);
    setOpen(false);
    onRestore();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
     <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-2 py-1 rounded hover:bg-gray-100"
      >
        <History className="h-4 w-4" />
        History
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/20"
            onClick={() => setOpen(false)}
          />

        
          <div className="w-80 bg-white h-full shadow-xl flex flex-col">
         
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <History className="h-4 w-4" />
                Version History
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

          
            {role !== 'viewer' && (
              <div className="px-4 py-3 border-b border-gray-100">
                {showInput ? (
                  <div className="flex flex-col gap-2">
                    <input
                      autoFocus
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveVersion()}
                      placeholder="Version name e.g. 'Final draft'"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={saveVersion}
                        disabled={saving || !label.trim()}
                        className="flex-1"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setShowInput(false); setLabel(''); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowInput(true)}
                    className="w-full"
                  >
                    <Save className="h-3.5 w-3.5 mr-2" />
                    Save current version
                  </Button>
                )}
              </div>
            )}

          
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                  Loading…
                </div>
              ) : versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <History className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-gray-500 text-sm">No versions saved yet.</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Save a version to capture a snapshot you can return to.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {versions.map((v, index) => (
                    <li
                      key={v.id}
                      className="px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {index === 0 && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                                Latest
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">
                            {v.label}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(v.createdAt)}
                          </p>
                        </div>

                        {role !== 'viewer' && index !== 0 && (
                          <button
                            onClick={() => restoreVersion(v.id)}
                            disabled={restoring === v.id}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                          >
                            <RotateCcw className="h-3 w-3" />
                            {restoring === v.id ? 'Restoring…' : 'Restore'}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}