import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Search, Users, Key, Lock, Trash2, Plus, X, UserPlus, Database, Save, Filter } from 'lucide-react';

function FilterValueInput({ initialValue, onSave }: { initialValue: string, onSave: (val: string) => void }) {
  const [val, setVal] = useState(initialValue);
  return <input type="text" value={val} onChange={e => setVal(e.target.value)} onBlur={() => onSave(val)} placeholder="Value" className="flex-1 w-0 border border-slate-200 p-1.5 rounded text-xs outline-none focus:border-indigo-500" />;
}

export default function AccessControl() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'groups' | 'users'>('groups');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [groupSubTab, setGroupSubTab] = useState<'permissions' | 'members'>('permissions');

  // Queries
  const { data: groupsRes } = useQuery({
    queryKey: ['access-groups'],
    queryFn: () => apiClient('/access/groups')
  });

  const { data: usersRes } = useQuery({
    queryKey: ['access-users'],
    queryFn: () => apiClient('/access/users')
  });

  const { data: dictionaryRes } = useQuery({
    queryKey: ['catalog-dictionary-admin'],
    queryFn: () => apiClient('/catalog/dictionary')
  });

  const groups = groupsRes || [];
  const users = usersRes || [];
  const dictionary = dictionaryRes || [];

  const selectedGroup = groups.find((g: any) => g._id === selectedGroupId);
  const selectedUser = users.find((u: any) => u._id === selectedUserId);

  const filteredGroups = groups.filter((g: any) => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredUsers = users.filter((u: any) => u.email.toLowerCase().includes(searchQuery.toLowerCase()));

  // Modals
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [isManageUserGroupsOpen, setIsManageUserGroupsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  // Mutations
  const createGroupMut = useMutation({
    mutationFn: (data: any) => apiClient('/access/groups', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['access-groups'] });
      setIsCreateGroupOpen(false);
      setSelectedGroupId(res._id);
      setNewGroupName(''); setNewGroupDesc('');
    }
  });

  const deleteGroupMut = useMutation({
    mutationFn: (id: string) => apiClient(`/access/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-groups'] });
      setDeleteConfirm(null);
      setSelectedGroupId(null);
    }
  });

  const updateMembersMut = useMutation({
    mutationFn: ({ id, userIds }: { id: string, userIds: string[] }) => apiClient(`/access/groups/${id}/members`, { method: 'PUT', body: JSON.stringify({ userIds }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-groups'] });
      queryClient.invalidateQueries({ queryKey: ['access-users'] });
      setIsManageMembersOpen(false);
    }
  });

  const updateUserRoleMut = useMutation({
    mutationFn: ({ id, role, groupIds }: { id: string, role: string, groupIds?: string[] }) => {
      const payload: any = { role };
      if (groupIds) payload.groupIds = groupIds;
      return apiClient(`/access/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-users'] });
      queryClient.invalidateQueries({ queryKey: ['access-groups'] });
      setIsManageUserGroupsOpen(false);
    }
  });

  const updateUserStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => apiClient(`/access/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-users'] })
  });

  const deleteUserMut = useMutation({
    mutationFn: (id: string) => apiClient(`/access/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-users'] });
      setDeleteConfirm(null);
      setSelectedUserId(null);
    }
  });

  const updatePermissionMut = useMutation({
    mutationFn: ({ groupId, collId, data }: { groupId: string, collId: string, data: any }) =>
      apiClient(`/access/groups/${groupId}/permissions/${collId}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-groups'] })
  });

  const deletePermissionMut = useMutation({
    mutationFn: ({ groupId, collId }: { groupId: string, collId: string }) =>
      apiClient(`/access/groups/${groupId}/permissions/${collId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-groups'] })
  });

  // UI Components inside
  const renderSidebar = () => (
    <div className="w-80 border-r border-slate-200 flex flex-col bg-[#F8FAFC]">
      <div className="p-4 border-b border-slate-200 bg-white shadow-sm z-10">
        <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4"><ShieldCheck size={18} className="text-indigo-600" /> Security Governance</h3>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button onClick={() => { setActiveTab('groups'); setSelectedUserId(null); }} className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors ${activeTab === 'groups' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Groups</button>
          <button onClick={() => { setActiveTab('users'); setSelectedGroupId(null); }} className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors ${activeTab === 'users' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Users</button>
        </div>
      </div>
      <div className="p-3 border-b border-slate-200 bg-white">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} type="text" placeholder={`Search ${activeTab}...`} className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
        </div>
        {activeTab === 'groups' && (
          <button onClick={() => setIsCreateGroupOpen(true)} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 py-2 rounded-lg transition-colors shadow-sm">
            <Plus size={14} /> Create New Group
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {activeTab === 'groups' ? (
          filteredGroups.map((g: any) => (
            <button key={g._id} onClick={() => setSelectedGroupId(g._id)} className={`w-full text-left p-3 rounded-lg border transition-all ${selectedGroupId === g._id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50'}`}>
              <div className="flex justify-between items-start mb-1">
                <span className={`font-bold text-sm ${selectedGroupId === g._id ? 'text-indigo-900' : 'text-slate-800'}`}>{g.name}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2 font-medium">
                <span className="flex items-center gap-1"><Users size={12} /> {g.memberCount} Members</span>
                <span className="flex items-center gap-1"><Database size={12} /> {g.permissions?.length || 0} Collections</span>
              </div>
            </button>
          ))
        ) : (
          filteredUsers.map((u: any) => (
            <button key={u._id} onClick={() => setSelectedUserId(u._id)} className={`w-full text-left p-3 rounded-lg border transition-all ${selectedUserId === u._id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50'}`}>
              <div className="flex justify-between items-start mb-1">
                <div className="font-bold text-[13px] text-slate-800 truncate">{u.email}</div>
                <div className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : u.status === 'blocked' ? 'bg-red-100 text-red-700' : u.status === 'rejected' ? 'bg-slate-200 text-slate-500' : 'bg-orange-100 text-orange-700'}`}>{u.status || 'active'}</div>
              </div>
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 mt-2">
                <span className="px-1.5 py-0.5 rounded bg-slate-100">{u.role.replace('_', ' ')}</span>
                <span className="flex items-center gap-1"><Users size={12} /> {u.groupIds?.length || 0} Groups</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-10 bg-white text-center">
      <div className="w-20 h-20 bg-slate-50 border border-slate-100 text-indigo-200 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
        <ShieldCheck size={40} />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Select an entity to configure</h2>
      <p className="text-sm text-slate-500 max-w-sm leading-relaxed">Manage robust table, column, and row-level access matrices securely via the unified Access Control boundary.</p>
    </div>
  );

  const renderManageMembersModal = () => {
    if (!isManageMembersOpen || !selectedGroup) return null;
    const currentMembers = new Set(selectedGroup.userIds);
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-2xl w-[500px] shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-900">Manage Members: {selectedGroup.name}</h2>
            <button onClick={() => setIsManageMembersOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 mb-6">
            {users.map((u: any) => {
              const isMember = currentMembers.has(u._id);
              return (
                <div key={u._id} className="flex justify-between items-center p-3 hover:bg-slate-50">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{u.email}</div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 mt-1">{u.role.replace('_', ' ')}</div>
                  </div>
                  <button
                    onClick={() => {
                      const newMembers = isMember
                        ? Array.from(currentMembers).filter(id => id !== u._id)
                        : [...Array.from(currentMembers), u._id];
                      updateMembersMut.mutate({ id: selectedGroup._id, userIds: newMembers });
                    }}
                    disabled={updateMembersMut.isPending}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${isMember ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    {isMember ? 'Remove' : 'Add Member'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderManageUserGroupsModal = () => {
    if (!isManageUserGroupsOpen || !selectedUser) return null;
    const currentGroups = new Set(selectedUser.groupIds);
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-2xl w-[500px] shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-900">Assign Groups: {selectedUser.email}</h2>
            <button onClick={() => setIsManageUserGroupsOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 mb-6">
            {groups.map((g: any) => {
              const isAssigned = currentGroups.has(g._id);
              return (
                <div key={g._id} className="flex justify-between items-center p-3 hover:bg-slate-50">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{g.name}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-1">{g.memberCount} Members</div>
                  </div>
                  <button
                    onClick={() => {
                      const newGroups = isAssigned
                        ? Array.from(currentGroups).filter(id => id !== g._id)
                        : [...Array.from(currentGroups), g._id];
                      updateUserRoleMut.mutate({ id: selectedUser._id, role: selectedUser.role, groupIds: newGroups });
                    }}
                    disabled={updateUserRoleMut.isPending}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${isAssigned ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    {isAssigned ? 'Remove' : 'Assign'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderGroupDetail = () => {
    if (!selectedGroup) return null;
    return (
      <div className="flex-1 flex flex-col bg-white overflow-hidden animate-in fade-in slide-in-from-right-8 duration-300">
        <div className="px-8 py-6 border-b border-slate-200">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">{selectedGroup.name}</h2>
              <p className="text-sm text-slate-500 font-medium">{selectedGroup.description || 'No description provided.'}</p>
            </div>
            <button onClick={() => setDeleteConfirm(selectedGroup._id)} className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-100">
              <Trash2 size={14} /> Delete Group
            </button>
          </div>

          <div className="flex gap-6 border-b border-slate-200">
            <button onClick={() => setGroupSubTab('permissions')} className={`pb-3 text-sm font-bold transition-colors relative ${groupSubTab === 'permissions' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>
              <div className="flex items-center gap-2"><Lock size={16} /> Permissions Matrix</div>
              {groupSubTab === 'permissions' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
            </button>
            <button onClick={() => setGroupSubTab('members')} className={`pb-3 text-sm font-bold transition-colors relative ${groupSubTab === 'members' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>
              <div className="flex items-center gap-2"><Users size={16} /> Assigned Members <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{selectedGroup.memberCount}</span></div>
              {groupSubTab === 'members' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          {groupSubTab === 'members' && (
            <div className="max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800">Direct Members</h3>
                <button onClick={() => setIsManageMembersOpen(true)} className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors">
                  <UserPlus size={14} /> Manage Memberships
                </button>
              </div>
              {selectedGroup.userIds.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                  <Users size={32} className="text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-700 mb-1">No members assigned</h4>
                  <p className="text-xs text-slate-500">Add users to this group to grant them inherited access.</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 shadow-sm">
                  {users.filter((u: any) => selectedGroup.userIds.includes(u._id)).map((u: any) => (
                    <div key={u._id} className="flex justify-between items-center p-4">
                      <div className="font-bold text-sm text-slate-800">{u.email}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50 px-2.5 py-1 rounded border border-slate-100">{u.role.replace('_', ' ')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {groupSubTab === 'permissions' && (
            <div className="space-y-6">
              {dictionary.map((coll: any) => {
                const existingPerm = selectedGroup.permissions?.find((p: any) => p.collectionId === coll._id);
                const hasAccess = !!existingPerm?.canRead;
                // Normalize fields: dictionary returns objects { name, type, description }, but permissions use plain field name strings
                const fieldNames: string[] = (coll.fields || []).map((f: any) => typeof f === 'string' ? f : f.name);
                const isPartial = hasAccess && (existingPerm.allowedFields?.length > 0 || existingPerm.deniedFields?.length > 0 || existingPerm.rowFilters?.length > 0);

                return (
                  <div key={coll.slug} className={`bg-white border rounded-xl shadow-sm transition-colors ${hasAccess ? 'border-indigo-200' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between p-5">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-[15px] text-slate-800 uppercase tracking-tight">{coll.name}</h3>
                          {!hasAccess ? <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">No Access</span>
                            : isPartial ? <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200 relative"><span className="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-300 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span></span> Partial Access</span>
                              : <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">Full Access</span>}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">Fields: {fieldNames.length}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center cursor-pointer">
                          <div className="relative">
                            <input type="checkbox" className="sr-only" checked={hasAccess} onChange={(e) => {
                              if (e.target.checked) updatePermissionMut.mutate({ groupId: selectedGroup._id, collId: coll._id, data: { collectionId: coll._id, canRead: true, allowedFields: [], deniedFields: [], rowFilters: [] } });
                              else deletePermissionMut.mutate({ groupId: selectedGroup._id, collId: coll._id });
                            }} />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${hasAccess ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>
                            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${hasAccess ? 'translate-x-4' : 'translate-x-0'}`}></div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {hasAccess && (
                      <div className="border-t border-slate-100 p-5 bg-slate-50/50 space-y-5 rounded-b-xl animate-in slide-in-from-top-2 duration-200">
                        {/* Matrix Configuration Blocks */}
                        <div className="grid grid-cols-2 gap-6">
                          <div className="bg-white p-4 rounded-lg border border-slate-200">
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-2"><Key size={12} /> Allowed Fields Filter</h4>
                            <div className="border border-slate-200 bg-slate-50 rounded-lg max-h-36 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-slate-300">
                              {fieldNames.map((fieldName: string) => {
                                const isAllowed = existingPerm.allowedFields?.length > 0
                                  ? existingPerm.allowedFields.includes(fieldName)
                                  : true; // implicitly allowed when empty

                                return (
                                  <label key={fieldName} className="flex items-center gap-2.5 p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 cursor-pointer transition-colors group">
                                    <input
                                      type="checkbox"
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                      checked={isAllowed}
                                      onChange={(e) => {
                                        let newFields = existingPerm.allowedFields?.length > 0
                                          ? [...existingPerm.allowedFields]
                                          : [...fieldNames];

                                        if (e.target.checked) {
                                          if (!newFields.includes(fieldName)) newFields.push(fieldName);
                                        } else {
                                          newFields = newFields.filter((f: string) => f !== fieldName);
                                        }

                                        // Clean up: if everything is checked, reset to empty array for cleaner payload
                                        if (newFields.length === fieldNames.length) newFields = [];

                                        updatePermissionMut.mutate({
                                          groupId: selectedGroup._id,
                                          collId: coll._id,
                                          data: { ...existingPerm, allowedFields: newFields }
                                        });
                                      }}
                                    />
                                    <span className={`text-[13px] font-mono transition-colors ${isAllowed ? 'text-indigo-700 font-bold' : 'text-slate-600 group-hover:text-slate-900'}`}>{fieldName}</span>
                                  </label>
                                );
                              })}
                              {fieldNames.length === 0 && (
                                <div className="p-3 text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">No mapped fields</div>
                              )}
                            </div>
                          </div>
                          <div className="bg-white p-4 rounded-lg border border-slate-200">
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-2"><Filter size={12} /> Row Level Filters</h4>
                            <p className="text-[11px] text-slate-400 mb-2 font-medium">Specify constraints (e.g. `department = "Engineering"`).</p>
                            <div className="space-y-2 mb-3">
                              {existingPerm.rowFilters?.map((rf: any, i: number) => (
                                <div key={i} className="flex gap-2 items-center">
                                  <select value={rf.field} className="flex-1 w-0 border border-slate-200 p-1.5 rounded text-xs outline-none focus:border-indigo-500 bg-white" onChange={(e) => {
                                    const newFilters = [...existingPerm.rowFilters]; newFilters[i].field = e.target.value;
                                    updatePermissionMut.mutate({ groupId: selectedGroup._id, collId: coll._id, data: { ...existingPerm, rowFilters: newFilters } });
                                  }}>
                                    <option value="" disabled>Select Field...</option>
                                    {fieldNames.map((fn: string) => <option key={fn} value={fn}>{fn}</option>)}
                                  </select>

                                  <select value={rf.operator} className="flex-1 w-0 border border-slate-200 p-1.5 rounded text-xs outline-none focus:border-indigo-500 bg-white" onChange={(e) => {
                                    const newFilters = [...existingPerm.rowFilters]; newFilters[i].operator = e.target.value;
                                    updatePermissionMut.mutate({ groupId: selectedGroup._id, collId: coll._id, data: { ...existingPerm, rowFilters: newFilters } });
                                  }}>
                                    <option value="eq">eq (=)</option>
                                    <option value="neq">neq (≠)</option>
                                    <option value="in">in</option>
                                    <option value="nin">nin (not in)</option>
                                    <option value="gt">gt (&gt;)</option>
                                    <option value="gte">gte (≥)</option>
                                    <option value="lt">lt (&lt;)</option>
                                    <option value="lte">lte (≤)</option>
                                  </select>

                                  <FilterValueInput initialValue={rf.value} onSave={(val) => {
                                    if (val === rf.value) return; // ignore if no change
                                    const newFilters = [...existingPerm.rowFilters]; newFilters[i].value = val;
                                    updatePermissionMut.mutate({ groupId: selectedGroup._id, collId: coll._id, data: { ...existingPerm, rowFilters: newFilters } });
                                  }} />

                                  <button onClick={() => {
                                    const newFilters = existingPerm.rowFilters.filter((_: any, idx: number) => idx !== i);
                                    updatePermissionMut.mutate({ groupId: selectedGroup._id, collId: coll._id, data: { ...existingPerm, rowFilters: newFilters } });
                                  }} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                                </div>
                              ))}
                            </div>
                            <button onClick={() => {
                              const defaultField = fieldNames[0] || '';
                              const newFilters = [...(existingPerm.rowFilters || []), { field: defaultField, operator: 'eq', value: '' }];
                              updatePermissionMut.mutate({ groupId: selectedGroup._id, collId: coll._id, data: { ...existingPerm, rowFilters: newFilters } });
                            }} className="text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded transition-colors w-full">+ Add Filter Condition</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {renderManageMembersModal()}
      </div>
    );
  };

  const renderUserDetail = () => {
    if (!selectedUser) return null;
    const isSelf = currentUser?.id === selectedUser._id;
    return (
      <div className="flex-1 flex flex-col bg-white overflow-hidden animate-in fade-in slide-in-from-right-8 duration-300">
        <div className="px-8 py-10 border-b border-slate-200 text-center">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-white shadow-lg">
            <Users size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">{selectedUser.email}</h2>
          <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest mt-2 border border-slate-200 shadow-sm">
            <ShieldCheck size={14} className="text-indigo-500" /> {selectedUser.role.replace('_', ' ')}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          <div className="max-w-lg mx-auto w-full space-y-8">

            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Platform Access Lifecycle</label>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${selectedUser.status === 'active' ? 'bg-emerald-100 text-emerald-700' : selectedUser.status === 'blocked' ? 'bg-red-100 text-red-700' : selectedUser.status === 'rejected' ? 'bg-slate-200 text-slate-500' : 'bg-orange-100 text-orange-700'}`}>{selectedUser.status || 'active'}</span>
              </div>

              {selectedUser.status === 'pending' && (
                <div className="flex gap-3 mt-4">
                  <button onClick={() => updateUserStatusMut.mutate({ id: selectedUser._id, status: 'active' })} disabled={updateUserStatusMut.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-sm transition-colors shadow-sm">Approve Access</button>
                  <button onClick={() => updateUserStatusMut.mutate({ id: selectedUser._id, status: 'rejected' })} disabled={updateUserStatusMut.isPending} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-lg text-sm transition-colors">Reject Request</button>
                </div>
              )}

              {selectedUser.status === 'active' && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-3">Active users can be temporarily blocked to instantly revoke platform access without deleting their account matrix.</p>
                  {isSelf ? (
                    <p className="text-xs font-bold text-slate-400 italic bg-slate-50 p-2 rounded text-center">You cannot block your own ongoing session.</p>
                  ) : (
                    <button onClick={() => updateUserStatusMut.mutate({ id: selectedUser._id, status: 'blocked' })} disabled={updateUserStatusMut.isPending} className="text-sm font-bold border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors w-full">Block User</button>
                  )}
                </div>
              )}

              {(selectedUser.status === 'blocked' || selectedUser.status === 'rejected') && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <button onClick={() => updateUserStatusMut.mutate({ id: selectedUser._id, status: 'active' })} disabled={updateUserStatusMut.isPending} className="text-sm font-bold border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors w-full">Restore Access</button>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Platform Role Assignment</label>
              <select
                className={`w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${isSelf ? 'opacity-60 cursor-not-allowed' : ''}`}
                value={selectedUser.role}
                disabled={isSelf}
                onChange={(e) => updateUserRoleMut.mutate({ id: selectedUser._id, role: e.target.value })}
              >
                <option value="platform_admin">Platform Admin (Superuser)</option>
                <option value="data_steward">Data Steward</option>
                <option value="analyst">Analyst</option>
                <option value="viewer">Viewer</option>
              </select>
              <p className="mt-3 text-[11px] font-medium text-slate-500 leading-relaxed">
                Updating this overrides native inherited controls globally. Viewers require group authorizations to read anything.
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Assigned Access Groups</label>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">Users inherit all explicit bounds.</p>
                </div>
                <button onClick={() => setIsManageUserGroupsOpen(true)} className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                  Edit Assignments
                </button>
              </div>
              <div className="space-y-2">
                {selectedUser.groupIds.map((gid: string) => {
                  const gInfo = groups.find((gr: any) => gr._id === gid);
                  return gInfo ? (
                    <div key={gid} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-sm font-bold text-slate-800">{gInfo.name}</span>
                      <Database size={14} className="text-slate-400" />
                    </div>
                  ) : null;
                })}
                {selectedUser.groupIds.length === 0 && (
                  <div className="text-center p-4 py-6 border border-dashed border-slate-300 rounded-lg">
                    <p className="text-xs font-medium text-slate-400">User is not assigned to any specific governance group.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Assign them from the Groups panel.</p>
                  </div>
                )}
              </div>
            </div>

            <div className={`bg-white border p-6 rounded-xl shadow-sm border-dashed ${isSelf ? 'border-slate-200' : 'border-red-200'}`}>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${isSelf ? 'text-slate-500' : 'text-red-500'}`}><Trash2 size={12} /> Danger Zone</label>
              <p className="text-[11px] font-medium text-slate-500 leading-relaxed mb-4">Deleting a user irreversibly wipes their complete permission matrix and login credentials.</p>
              {isSelf ? (
                <button disabled className="w-full text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200 px-4 py-2 rounded-lg cursor-not-allowed">Cannot Delete Own Account</button>
              ) : (
                <button onClick={() => setDeleteConfirm(selectedUser._id)} className="w-full text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-100 px-4 py-2 rounded-lg transition-colors">Delete Account</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-white h-full overflow-hidden">
      {renderSidebar()}

      {activeTab === 'groups' ? (selectedGroupId ? renderGroupDetail() : renderEmptyState())
        : (selectedUserId ? renderUserDetail() : renderEmptyState())}

      {renderManageUserGroupsModal()}

      {/* Create Group Modal */}
      {isCreateGroupOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl w-[400px] shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-900">Create Security Group</h2>
              <button onClick={() => setIsCreateGroupOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Group Name</label>
                <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g. HR Analyst Access" className="w-full border border-slate-200 p-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Description (Optional)</label>
                <textarea value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} placeholder="Define scope of group..." rows={3} className="w-full border border-slate-200 p-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsCreateGroupOpen(false)} className="px-4 py-2 text-sm text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => createGroupMut.mutate({ name: newGroupName, description: newGroupDesc })} disabled={!newGroupName.trim() || createGroupMut.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm border border-indigo-700 disabled:opacity-50 flex items-center gap-2">
                {createGroupMut.isPending ? 'Creating...' : <><Save size={16} /> Create Group</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete group confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl w-96 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold mb-2 text-slate-900 flex items-center gap-2"><Trash2 size={18} className="text-red-500" /> Delete Entity?</h2>
            <p className="text-sm text-slate-500 mb-6 font-medium leading-relaxed">
              Are you sure you want to delete this {selectedGroup ? 'security group' : 'user account'}? All explicit configurations will be irreversibly wiped.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => {
                if (selectedGroup) deleteGroupMut.mutate(deleteConfirm);
                else if (selectedUser) deleteUserMut.mutate(deleteConfirm);
              }} disabled={deleteGroupMut.isPending || deleteUserMut.isPending} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow border border-red-700">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
