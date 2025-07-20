import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import CreateGroupModal from '../components/CreateGroupModal';
import GroupManagement from '../components/GroupManagement';

const Chats = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingChat, setCreatingChat] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError('');
      
      try {
        const [usersRes, chatsRes] = await Promise.all([
          axios.get('/users'),
          axios.get('/chat')  
        ]);

        setUsers(usersRes.data.filter(u => u._id !== user._id));
        setChats(chatsRes.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load data. Please try again.');
        setUsers([]);
        setChats([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Real-time updates
  useEffect(() => {
    if (!socket?.current) return;

    const socketInstance = socket.current;

    const handleMessageReceived = (newMessage) => {
      setChats(prevChats => {
        const updatedChats = prevChats.map(chat => {
          if (chat._id === newMessage.chat._id || chat._id === newMessage.chat) {
            return {
              ...chat,
              latestMessage: newMessage,
              updatedAt: newMessage.createdAt,
              unreadCount: (chat.unreadCount || 0) + 1
            };
          }
          return chat;
        });
        
        return updatedChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });
    };

    const handleUserOnline = (userId) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    };

    const handleUserOffline = (userId) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };

    socketInstance.on('message received', handleMessageReceived);
    socketInstance.on('user online', handleUserOnline);
    socketInstance.on('user offline', handleUserOffline);

    return () => {
      socketInstance.off('message received', handleMessageReceived);
      socketInstance.off('user online', handleUserOnline);
      socketInstance.off('user offline', handleUserOffline);
    };
  }, [socket]);

  const handleStartChat = async (userId) => {
    setCreatingChat(userId);
    setError('');
    
    try {
      const res = await axios.post('/chat', { userId });
      navigate(`/chats/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create chat. Please try again.');
    } finally {
      setCreatingChat(null);
    }
  };

  const handleExistingChat = (chatId) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat._id === chatId ? { ...chat, unreadCount: 0 } : chat
      )
    );
    navigate(`/chats/${chatId}`);
  };

  const handleGroupCreated = (newGroup) => {
    setChats(prevChats => [newGroup, ...prevChats]);
    setShowCreateGroup(false);
  };

  const handleGroupUpdated = (updatedGroup) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat._id === updatedGroup._id ? updatedGroup : chat
      )
    );
  };

  const handleGroupSettingsClick = (chat, e) => {
    e.stopPropagation();
    setSelectedChat(chat);
    setShowGroupManagement(true);
  };

  const getOtherParticipant = (chat) => {
    if (chat.isGroupChat) return null;
    return chat.users?.find(p => p._id !== user._id);
  };

  const getChatDisplayName = (chat) => {
    if (chat.isGroupChat) {
      return chat.chatName || 'Group Chat';
    }
    const otherParticipant = getOtherParticipant(chat);
    return otherParticipant?.name || 'Unknown User';
  };

  const getChatDisplayAvatar = (chat) => {
    if (chat.isGroupChat) {
      return chat.chatName?.charAt(0)?.toUpperCase() || 'G';
    }
    const otherParticipant = getOtherParticipant(chat);
    return otherParticipant?.name?.charAt(0)?.toUpperCase() || '?';
  };

  const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
  };

  const formatRecentTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;
    return date.toLocaleDateString();
  };

  const getAvailableUsers = () => {
    const existingChatUserIds = chats
      .filter(chat => !chat.isGroupChat)
      .map(chat => {
        const otherParticipant = getOtherParticipant(chat);
        return otherParticipant?._id;
      }).filter(Boolean);

    return users.filter(user => !existingChatUserIds.includes(user._id));
  };

  const availableUsers = getAvailableUsers();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center p-8">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 dark:border-gray-700 mx-auto mb-6"></div>
            <div className="absolute inset-0 animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-indigo-600 dark:border-t-indigo-400 mx-auto"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">Loading your chats...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.186-.833-2.964 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Authentication Required</h3>
              <p className="text-gray-600 dark:text-gray-300">Please log in to access your chats and start conversations.</p>
            </div>
            <button 
              onClick={() => window.location.href = '/login'}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
        {/* Error display */}
        {error && (
          <div className="mb-6 mx-auto max-w-2xl">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Something went wrong</h3>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="mt-3 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-200"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Existing Chats Section */}
        {chats.length > 0 && (
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Conversations</h2>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Create Group</span>
              </button>
            </div>
            <div className="grid gap-3">
              {chats.map(chat => {
                const otherParticipant = getOtherParticipant(chat);
                const isOnline = !chat.isGroupChat && isUserOnline(otherParticipant?._id);
                const unreadCount = chat.unreadCount || 0;
                const displayName = getChatDisplayName(chat);
                const displayAvatar = getChatDisplayAvatar(chat);
                
                return (
                  <button
                    key={chat._id}
                    onClick={() => handleExistingChat(chat._id)}
                    className={`group relative p-4 sm:p-6 border rounded-2xl hover:shadow-lg transition-all duration-300 flex items-center space-x-4 w-full text-left transform hover:-translate-y-1 ${
                      unreadCount > 0 
                        ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800 shadow-md' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 ${chat.isGroupChat ? 'bg-gradient-to-br from-pink-500 to-rose-500' : 'bg-gradient-to-br from-indigo-500 to-purple-500'} rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                        {displayAvatar}
                      </div>
                      {!chat.isGroupChat && isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full shadow-sm"></div>
                      )}
                      {chat.isGroupChat && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-sm">
                          <svg className="w-3 h-3 text-pink-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center min-w-0 flex-1">
                          <h3 className={`font-semibold truncate text-lg ${unreadCount > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'}`}>
                            {displayName}
                          </h3>
                          {chat.isGroupChat && (
                            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                              ({chat.users.length})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          {chat.latestMessage && (
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                              {formatRecentTime(chat.latestMessage.createdAt)}
                            </span>
                          )}
                          {chat.isGroupChat && (
                            <button
                              onClick={(e) => handleGroupSettingsClick(chat, e)}
                              className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200 opacity-0 group-hover:opacity-100"
                              title="Group Settings"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                          )}
                          {unreadCount > 0 && (
                            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-bold px-2 shadow-lg">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {chat.latestMessage ? (
                        <div className="flex items-center">
                          <p className={`text-sm truncate flex-1 ${unreadCount > 0 ? 'font-medium text-gray-700 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}`}>
                            {chat.isGroupChat && chat.latestMessage.sender._id !== user._id ? 
                              <span className="font-medium text-indigo-600 dark:text-indigo-400">{chat.latestMessage.sender.name}: </span> : 
                              (chat.latestMessage.sender._id === user._id ? <span className="text-gray-500">You: </span> : '')
                            }
                            {chat.latestMessage.attachments?.length > 0 ? (
                              <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                {chat.latestMessage.attachments[0].type === 'image' ? 'Photo' : 'File'}
                              </span>
                            ) : (
                              chat.latestMessage.content
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">Start the conversation...</p>
                      )}
                      
                      {!chat.isGroupChat && isOnline && (
                        <div className="flex items-center mt-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">Online now</p>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* No Chats Message */}
        {chats.length === 0 && !error && (
          <div className="mb-8 text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">No conversations yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">Start your first conversation by creating a group or chatting with someone below!</p>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2 mx-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Create Group Chat</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Start New Chat Section */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white text-center sm:text-left">
            {chats.length === 0 ? 'Start Your First Chat' : 'Start a New Chat'}
          </h2>
          {availableUsers.length === 0 && !error ? (
            <div className="text-center py-12">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                {users.length === 0 ? (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No users available</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">There are no other users to chat with at the moment.</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">All caught up!</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">You already have conversations with all available users.</p>
                  </div>
                )}
                <button 
                  onClick={() => window.location.reload()} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors duration-200"
                >
                  Refresh
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {availableUsers.map(u => (
                <button
                  key={u._id}
                  onClick={() => handleStartChat(u._id)}
                  disabled={creatingChat === u._id}
                  className={`group p-4 sm:p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300 flex items-center space-x-4 w-full text-left transform hover:-translate-y-1 ${
                    creatingChat === u._id ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {u.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white truncate">{u.name}</h3>
                    {u.email && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{u.email}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {creatingChat === u._id ? (
                      <div className="relative">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-200 dark:border-gray-600"></div>
                        <div className="absolute inset-0 animate-spin rounded-full h-6 w-6 border-2 border-transparent border-t-indigo-600 dark:border-t-indigo-400"></div>
                      </div>
                    ) : (
                      <svg className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Create Group Modal */}
        <CreateGroupModal 
          isOpen={showCreateGroup} 
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={handleGroupCreated}
        />

        {/* Group Management Modal */}
        <GroupManagement
          chat={selectedChat}
          isOpen={showGroupManagement}
          onClose={() => {
            setShowGroupManagement(false);
            setSelectedChat(null);
          }}
          onGroupUpdated={handleGroupUpdated}
        />
      </div>
    </div>
  );
};

export default Chats;