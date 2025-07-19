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
      <div className="flex justify-center items-center min-h-screen bg-[#F9FAFB] dark:bg-[#1F2937]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366F1] mx-auto mb-4"></div>
          <p className="text-[#6B7280] dark:text-[#E5E7EB]">Loading chats...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 bg-[#F9FAFB] dark:bg-[#1F2937]">
        <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded mb-4">
          <p className="font-medium">Authentication Required</p>
          <p>Please log in to access your chats.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto bg-[#F9FAFB] dark:bg-[#1F2937] min-h-screen">
      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
          <p className="font-medium">Error</p>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 bg-[#6366F1] text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Existing Chats Section */}
      {chats.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-[#111827] dark:text-[#F3F4F6]">Your Chats</h2>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="bg-[#6366F1] text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Create Group</span>
            </button>
          </div>
          <div className="grid gap-2">
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
                  className={`p-4 border rounded-lg hover:bg-[#E0E7FF]/30 dark:hover:bg-gray-700 flex justify-between items-center transition-colors relative ${
                    unreadCount > 0 ? 'bg-[#E0E7FF]/20 dark:bg-indigo-900/20 border-[#C7D2FE] dark:border-indigo-800' : 'bg-white dark:bg-gray-800 border-[#E5E7EB] dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center flex-1">
                    <div className="relative mr-3">
                      <div className={`w-12 h-12 ${chat.isGroupChat ? 'bg-[#F472B6]' : 'bg-[#6366F1]'} rounded-full flex items-center justify-center text-white font-medium`}>
                        {displayAvatar}
                      </div>
                      {!chat.isGroupChat && isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                      )}
                      {chat.isGroupChat && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-full flex items-center justify-center">
                          <svg className="w-2 h-2 text-[#F472B6]" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-left flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center">
                          <p className={`font-medium truncate ${unreadCount > 0 ? 'text-[#111827] dark:text-[#F3F4F6]' : 'text-[#111827] dark:text-[#F3F4F6]'}`}>
                            {displayName}
                          </p>
                          {chat.isGroupChat && (
                            <span className="ml-2 text-xs text-[#6B7280] dark:text-gray-400">
                              ({chat.users.length} members)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center ml-2">
                          {chat.latestMessage && (
                            <span className="text-xs text-[#6B7280] dark:text-gray-400">
                              {formatRecentTime(chat.latestMessage.createdAt)}
                            </span>
                          )}
                          {chat.isGroupChat && (
                            <button
                              onClick={(e) => handleGroupSettingsClick(chat, e)}
                              className="ml-2 p-1 text-[#6B7280] dark:text-gray-400 hover:text-[#6366F1] dark:hover:text-indigo-300"
                              title="Group Settings"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                          )}
                          {unreadCount > 0 && (
                            <div className="ml-2 bg-[#6366F1] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {chat.latestMessage ? (
                        <div className="mt-1">
                          <p className={`text-sm truncate ${unreadCount > 0 ? 'font-medium text-[#111827] dark:text-[#F3F4F6]' : 'text-[#6B7280] dark:text-gray-400'}`}>
                            {chat.isGroupChat && chat.latestMessage.sender._id !== user._id ? 
                              `${chat.latestMessage.sender.name}: ` : 
                              (chat.latestMessage.sender._id === user._id ? 'You: ' : '')
                            }
                            {chat.latestMessage.attachments?.length > 0 ? (
                              <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1 text-[#6B7280] dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <p className="text-sm text-[#6B7280] dark:text-gray-400 italic">No messages yet</p>
                      )}
                      
                      {!chat.isGroupChat && isOnline && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">Online</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* No Chats Message */}
      {chats.length === 0 && !error && (
        <div className="mb-8 text-center py-8 bg-[#E0E7FF]/20 dark:bg-gray-700/30 rounded-lg">
          <div className="text-[#6B7280] dark:text-gray-400 mb-2">
            <svg className="w-16 h-16 mx-auto mb-4 text-[#C7D2FE] dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[#111827] dark:text-[#F3F4F6] mb-2">No chats yet</h3>
          <p className="text-[#6B7280] dark:text-gray-400 mb-4">Start a conversation with someone below or create a group!</p>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="bg-[#6366F1] text-white px-6 py-2 rounded-md hover:bg-indigo-700 flex items-center space-x-2 mx-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Create Group Chat</span>
          </button>
        </div>
      )}

      {/* Start New Chat Section */}
      <div>
        <h2 className="text-xl font-bold mb-4 text-[#111827] dark:text-[#F3F4F6]">
          {chats.length === 0 ? 'Start Your First Chat' : 'Start a New Chat'}
        </h2>
        {availableUsers.length === 0 && !error ? (
          <div className="text-center py-8 text-[#6B7280] dark:text-gray-400">
            {users.length === 0 ? (
              <p>No other users available to chat with.</p>
            ) : (
              <p>You already have chats with all available users!</p>
            )}
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 bg-[#6366F1] text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="grid gap-2">
            {availableUsers.map(u => (
              <button
                key={u._id}
                onClick={() => handleStartChat(u._id)}
                disabled={creatingChat === u._id}
                className={`p-3 bg-[#E0E7FF]/30 dark:bg-gray-700 rounded hover:bg-[#E0E7FF]/50 dark:hover:bg-gray-600 flex justify-between items-center transition-colors ${
                  creatingChat === u._id ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-[#6366F1] rounded-full flex items-center justify-center text-white font-medium mr-3">
                    {u.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <span className="font-medium text-[#111827] dark:text-[#F3F4F6]">{u.name}</span>
                  {u.email && (
                    <span className="text-sm text-[#6B7280] dark:text-gray-400 ml-2">({u.email})</span>
                  )}
                </div>
                {creatingChat === u._id && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#6366F1]"></div>
                )}
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
  );
};

export default Chats;