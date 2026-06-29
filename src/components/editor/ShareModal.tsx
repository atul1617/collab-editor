'use client';

import { useEffect, useState } from 'react';
import { X, UserPlus, Crown, Edit2, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Member {
  id: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  name: string | null;
  email: string | null;
  image: string | null;
}

interface ShareModalProps {
  documentId: string;
  currentUserId: string;
  currentUserRole: 'owner' | 'editor' | 'viewer';
}

const roleIcons = {
  owner: <Crown className="h-3.5 w-3.5 text-yellow-500" />,
  editor: <Edit2 className="h-3.5 w-3.5 text-blue-500" />,
  viewer: <Eye className="h-3.5 w-3.5 text-gray-400" />,
};

const roleColors = {
  owner: 'bg-yellow-50 text-yellow-700',
  editor: 'bg-blue-50 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
};

export function ShareModal({
  documentId,
  currentUserId,
  currentUserRole,
}: ShareModalProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchMembers = async () => {
    setLoading(true);
    const res = await fetch(`/api/documents/${documentId}/members`);
    const data = await res.json();
    setMembers(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchMembers();
  }, [open]);

  const inviteMember = async () => {
    if (!email.trim()) return;
    setInviting(true);
    setError('');
    setSuccess('');

    const res = await fetch(`/api/documents/${documentId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), role }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Failed to invite user');
    } else {
      setSuccess(`${data.email} added as ${role}`);
      setEmail('');
      await fetchMembers();
    }

    setInviting(false);
  };

  const changeRole = async (memberId: string, newRole: 'editor' | 'viewer') => {
    await fetch(`/api/documents/${documentId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    await fetchMembers();
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this member from the document?')) return;
    await fetch(`/api/documents/${documentId}/members/${memberId}`, {
      method: 'DELETE',
    });
    await fetchMembers();
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return '?';
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-2 py-1 rounded hover:bg-gray-100"
      >
        <UserPlus className="h-4 w-4" />
        Share
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />

           <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Share Document</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {currentUserRole === 'owner' && (
              <div className="px-6 py-4 border-b border-gray-100">
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Invite by email
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); setSuccess(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && inviteMember()}
                    placeholder="colleague@example.com"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                    className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <Button
                  onClick={inviteMember}
                  disabled={inviting || !email.trim()}
                  className="w-full"
                  size="sm"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-2" />
                  {inviting ? 'Inviting…' : 'Invite'}
                </Button>

                {error && (
                  <p className="text-red-500 text-xs mt-2">{error}</p>
                )}
                {success && (
                  <p className="text-green-600 text-xs mt-2">✓ {success}</p>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                People with access
              </p>

              {loading ? (
                <div className="text-center text-gray-400 text-sm py-6">Loading…</div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-3"
                    >
                     
                      <div className="flex items-center gap-3 min-w-0">
                        {member.image ? (
                          <img
                            src={member.image}
                            alt={member.name ?? ''}
                            className="h-8 w-8 rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                            {getInitials(member.name, member.email)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {member.name ?? member.email}
                            {member.userId === currentUserId && (
                              <span className="text-gray-400 font-normal"> (you)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{member.email}</p>
                        </div>
                      </div>

                   
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {member.role === 'owner' || currentUserRole !== 'owner' || member.userId === currentUserId ? (
                        
                          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${roleColors[member.role]}`}>
                            {roleIcons[member.role]}
                            {member.role}
                          </span>
                        ) : (
                          
                          <div className="flex items-center gap-1">
                            <select
                              value={member.role}
                              onChange={(e) => changeRole(member.id, e.target.value as 'editor' | 'viewer')}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                            >
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button
                              onClick={() => removeMember(member.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors p-1"
                              title="Remove member"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

         
            <div className="px-6 py-3 bg-gray-50 rounded-b-2xl border-t border-gray-100">
              <p className="text-xs text-gray-400">
                <span className="font-medium text-gray-500">Owner</span> can manage members ·{' '}
                <span className="font-medium text-gray-500">Editor</span> can edit ·{' '}
                <span className="font-medium text-gray-500">Viewer</span> can only read
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}