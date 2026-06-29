'use client';

import { useSyncEngine } from '@/lib/sync/SyncContext';

const statusConfig = {
  loading:    { color: 'bg-gray-400', label: 'Loading…' },
  connected:  { color: 'bg-green-500', label: 'Live' },
  connecting: { color: 'bg-yellow-400', label: 'Syncing…' },
  offline:    { color: 'bg-red-500',   label: 'Offline — edits saved locally' },
};

export function ConnectionStatus() {
  const { status, pendingOps } = useSyncEngine();
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
  
      <span className={`h-2 w-2 rounded-full ${config.color} ${
        status === 'connecting' ? 'animate-pulse' : ''
      }`} />
      <span>{config.label}</span>
    
      {pendingOps > 0 && (
        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
          {pendingOps} pending
        </span>
      )}
    </div>
  );
}