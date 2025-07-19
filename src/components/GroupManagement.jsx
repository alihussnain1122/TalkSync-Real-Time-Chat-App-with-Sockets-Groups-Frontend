// src/components/GroupManagement.jsx
import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import { useAuth } from '../context/AuthContext';

const GroupManagement = ({ chat, isOpen, onClose, onGroupUpdated }) => {
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('members');

  const isAdmin = chat?.groupAdmin?._id === user?._id;

  useEffect(() => {
    if (isOpen && chat) {
      setGroupName(chat.chatName || '');
      fetchUsers();
    }
  }, [isOpen, chat]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/users');
      // Filter out users who are already in the group
      const availableUsers = response.data.filter(
        user => !chat.users.some(member => member._id === user._id)
      );
      setUsers(availableUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users');
    }
  };

  const handleRenameGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || groupName === chat.chatName) return;

    setLoading(true);
    setError('');

    try {
      const response = await axios.put('/chat/rename', {
        chatId: chat._id,
        chatName: groupName.trim()
      });
      onGroupUpdated(response.data);
      setError('');
    } catch (err) {
      console.error('Error renaming group:', err);
      setError(err.response?.data?.message || 'Failed to rename group');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId) => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.put('/chat/groupadd', {
        chatId: chat._id,
        userId: userId
      });
      onGroupUpdated(response.data);
      // Remove the added user from available users list
      setUsers(users.filter(user => user._id !== userId));
    } catch (err) {
      console.error('Error adding member:', err);
      setError(err.response?.data?.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (userId === chat.groupAdmin._id) {
      setError('Cannot remove group admin');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.put('/chat/groupremove', {
        chatId: chat._id,
        userId: userId
      });
      onGroupUpdated(response.data);
      // Add the removed user to available users list if not already there
      const removedUser = chat.users.find(user => user._id === userId);
      if (removedUser && !users.some(user => user._id === userId)) {
        setUsers([...users, removedUser]);
      }
    } catch (err) {
      console.error('Error removing member:', err);
      setError(err.response?.data?.message || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClose = () => {
    setError('');
    setSearchTerm('');
    setActiveTab('members');
    onClose();
  };

  if (!isOpen || !chat?.isGroupChat) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Group Settings</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex mb-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'members'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Members ({chat.users.length})
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('add')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'add'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Add Members
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'settings'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Settings
              </button>
            </>
          )}
        </div>

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-800">Group Members</h3>
            <div className="max-h-60 overflow-y-auto">
              {chat.users.map(member => (
                <div key={member._id} className="flex items-center justify-between p-3 border border-gray-200 rounded-md mb-2">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {member.name}
                        {member._id === chat.groupAdmin._id && (
                          <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Admin</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  {isAdmin && member._id !== chat.groupAdmin._id && (
                    <button
                      onClick={() => handleRemoveMember(member._id)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Members Tab */}
        {activeTab === 'add' && isAdmin && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-800">Add New Members</h3>
            
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />

            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
              {filteredUsers.length === 0 ? (
                <p className="p-3 text-gray-500 text-sm text-center">
                  {searchTerm ? 'No users found' : 'All users are already in the group'}
                </p>
              ) : (
                filteredUsers.map(user => (
                  <div key={user._id} className="p-3 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddMember(user._id)}
                      disabled={loading}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && isAdmin && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-800">Group Settings</h3>
            
            <form onSubmit={handleRenameGroup}>
              <label htmlFor="groupNameEdit" className="block text-sm font-medium text-gray-700 mb-1">
                Group Name
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  id="groupNameEdit"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !groupName.trim() || groupName === chat.chatName}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>

            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Group Information</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <p>Created: {new Date(chat.createdAt).toLocaleDateString()}</p>
                <p>Members: {chat.users.length}</p>
                <p>Admin: {chat.groupAdmin.name}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupManagement;
