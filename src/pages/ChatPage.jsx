import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios, { getFileUrl } from '../utils/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const ChatPage = () => {
  const { chatId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();
  const messagesEndRef = useRef(null);
  
  // State management
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [chatInfo, setChatInfo] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  // Refs
  const typingTimerRef = useRef();
  const fileInputRef = useRef();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket setup and real-time message handling
  useEffect(() => {
    if (!socket?.current || !chatId) return;

    const socketInstance = socket.current;

    // Join the chat room
    socketInstance.emit('join chat', chatId);

    // Listen for new messages
    const handleNewMessage = (newMessage) => {
      if (newMessage.chat === chatId || newMessage.chat._id === chatId) {
        setMessages(prev => {
          const exists = prev.some(m => m._id === newMessage._id);
          if (exists) return prev;
          return [...prev, newMessage];
        });
      }
    };

    // Listen for typing events
    const handleTyping = ({ userId, userName }) => {
      if (userId !== user._id) {
        setTypingUsers(prev => new Set([...prev, { userId, userName: userName || 'Someone' }]));
      }
    };
    
    const handleStopTyping = ({ userId }) => {
      if (userId !== user._id) {
        setTypingUsers(prev => {
          const newSet = new Set();
          prev.forEach(typingUser => {
            if (typingUser.userId !== userId) {
              newSet.add(typingUser);
            }
          });
          return newSet;
        });
      }
    };

    socketInstance.on('message received', handleNewMessage);
    socketInstance.on('typing', handleTyping);
    socketInstance.on('stop typing', handleStopTyping);

    // Cleanup function
    return () => {
      socketInstance.off('message received', handleNewMessage);
      socketInstance.off('typing', handleTyping);
      socketInstance.off('stop typing', handleStopTyping);
      socketInstance.emit('leave chat', chatId);
    };
  }, [socket, chatId, user._id]);

  // Fetch chat info and messages
  useEffect(() => {
    const fetchChatData = async () => {
      if (!chatId || !user) return;
      
      setLoading(true);
      setError('');
      
      try {
        const messagesRes = await axios.get(`/message/${chatId}`);
        setMessages(messagesRes.data);
        
        const chatsRes = await axios.get('/chat');
        const currentChat = chatsRes.data.find(chat => chat._id === chatId);
        
        if (currentChat) {
          setChatInfo(currentChat);
          const other = currentChat.users?.find(p => p._id !== user._id);
          setOtherUser(other);
        }
      } catch (err) {
        setError('Failed to load chat. Please try again.',err);
      } finally {
        setLoading(false);
      }
    };

    fetchChatData();
  }, [chatId, user]);

  // Send message function
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if ((!newMessage.trim() && selectedFiles.length === 0) || sending) return;
    
    setSending(true);
    setError('');
    
    if (socket?.current) {
      socket.current.emit('stop typing', { chatId, userName: user.name });
    }
    
    try {
      let attachments = [];
      
      if (selectedFiles.length > 0) {
        setUploading(true);
        const formData = new FormData();
        selectedFiles.forEach(file => {
          formData.append('files', file);
        });
        
        const uploadRes = await axios.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        attachments = uploadRes.data.files || [];
        setUploading(false);
      }
      
      const res = await axios.post('/message', {
        chatId,
        content: newMessage.trim() || '',
        attachments
      });
      
      setMessages(prev => [...prev, res.data]);
      
      if (socket?.current && chatInfo) {
        socket.current.emit('new message', {
          ...res.data,
          chat: chatInfo
        });
      }
      
      setNewMessage('');
      setSelectedFiles([]);
    } catch (err) {
      setError(`Failed to send message: ${err.response?.data?.message || err.message}`);
      setUploading(false);
    } finally {
      setSending(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return false;
      }
      return true;
    });
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  // Handle typing indicators
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!socket?.current) return;
    
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    
    if (!typingTimerRef.current) {
      socket.current.emit('typing', { chatId, userName: user.name });
    }
    
    typingTimerRef.current = setTimeout(() => {
      socket.current.emit('stop typing', { chatId, userName: user.name });
      typingTimerRef.current = null;
    }, 3000);
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
             ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-[#F8FAFC] to-[#E0E7FF] dark:from-[#1F2937] dark:to-[#111827]">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 dark:border-gray-700 mx-auto"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#6366F1] mx-auto absolute top-0 left-1/2 transform -translate-x-1/2"></div>
          </div>
          <div className="space-y-3">
            <div className="h-2 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-full animate-pulse"></div>
            <p className="text-[#6B7280] dark:text-[#E5E7EB] font-medium">Loading your conversation...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Please wait while we fetch your messages</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !chatInfo) {
    return (
      <div className="p-4 sm:p-6 bg-gradient-to-br from-[#F8FAFC] to-[#E0E7FF] dark:from-[#1F2937] dark:to-[#111827] min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-red-600 p-4 text-white">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-lg">Oops! Something went wrong</h3>
                <p className="text-red-100 text-sm">We couldn't load this chat</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">{error}</p>
            <div className="flex space-x-3">
              <button 
                onClick={() => window.location.reload()} 
                className="flex-1 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white px-4 py-3 rounded-xl font-medium hover:from-[#5B56F0] hover:to-[#7C3AED] transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Try Again
              </button>
              <button 
                onClick={() => navigate('/chats')} 
                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
              >
                Back to Chats
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto bg-white dark:bg-gray-800 shadow-2xl lg:rounded-t-3xl lg:mt-2 overflow-hidden">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] dark:from-gray-800 dark:to-gray-900 border-b border-[#E5E7EB] dark:border-gray-700 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center min-w-0 flex-1">
          <button
            onClick={() => navigate('/chats')}
            className="mr-2 sm:mr-4 p-2 hover:bg-white/20 dark:hover:bg-gray-700 rounded-full transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5 text-white dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center min-w-0 flex-1">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 ${chatInfo?.isGroupChat ? 'bg-gradient-to-br from-[#F472B6] to-[#EC4899]' : 'bg-gradient-to-br from-[#10B981] to-[#059669]'} rounded-full flex items-center justify-center text-white font-bold mr-2 sm:mr-3 relative shadow-lg flex-shrink-0`}>
              {chatInfo?.isGroupChat ? 
                (chatInfo.chatName?.charAt(0)?.toUpperCase() || 'G') :
                (otherUser?.name?.charAt(0)?.toUpperCase() || '?')
              }
              {chatInfo?.isGroupChat && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-white dark:bg-gray-800 border-2 border-white dark:border-gray-600 rounded-full flex items-center justify-center">
                  <svg className="w-1.5 h-1.5 sm:w-2 sm:h-2 text-[#F472B6]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-lg font-bold text-white dark:text-[#F3F4F6] truncate">
                {chatInfo?.isGroupChat ? 
                  (chatInfo.chatName || 'Group Chat') :
                  (otherUser?.name || 'Unknown User')
                }
              </h1>
              <p className="text-xs sm:text-sm text-white/80 dark:text-gray-300 truncate">
                {chatInfo?.isGroupChat ? 
                  `${chatInfo.users?.length || 0} members` :
                  otherUser?.email
                }
              </p>
            </div>
          </div>
        </div>
        
        {/* Header Actions */}
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          <button className="p-2 hover:bg-white/20 dark:hover:bg-gray-700 rounded-full transition-colors hidden sm:block">
            <svg className="w-5 h-5 text-white dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button className="p-2 hover:bg-white/20 dark:hover:bg-gray-700 rounded-full transition-colors">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-3 sm:p-4 mx-2 sm:mx-4 mt-2 rounded-r-lg shadow-sm">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 bg-gradient-to-b from-[#F8FAFC] to-[#F1F5F9] dark:from-gray-700/30 dark:to-gray-800/30 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <div className="text-[#6B7280] dark:text-gray-400 mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[#111827] dark:text-[#F3F4F6] mb-2">No messages yet</h3>
            <p className="text-sm sm:text-base text-[#6B7280] dark:text-gray-400 max-w-md mx-auto">Start the conversation by sending a message below. Share your thoughts, files, or record a voice note!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.sender._id === user._id;
            return (
              <div
                key={message._id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              >
                <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2 max-w-[85%] sm:max-w-[70%] lg:max-w-[60%]`}>
                  {!isOwnMessage && chatInfo?.isGroupChat && (
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold flex-shrink-0 mb-1 shadow-md">
                      {message.sender.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <div
                    className={`px-3 sm:px-4 py-2 sm:py-3 rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-[1.02] message-bubble ${
                      isOwnMessage
                        ? 'bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white rounded-br-md ml-2'
                        : 'bg-white dark:bg-gray-700 text-[#111827] dark:text-[#F3F4F6] border border-gray-200 dark:border-gray-600 rounded-bl-md mr-2'
                    }`}
                  >
                    {chatInfo?.isGroupChat && !isOwnMessage && (
                      <p className="text-xs font-bold mb-2 text-[#6366F1] dark:text-indigo-300">
                        {message.sender.name}
                      </p>
                    )}
                    
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mb-2 space-y-2">
                        {message.attachments.map((attachment, index) => (
                          <div key={index} className="rounded-lg overflow-hidden">
                            {attachment.type === 'image' ? (
                              <div className="relative group">
                                <img
                                  src={getFileUrl(attachment.url)}
                                  alt="Attachment"
                                  className="max-w-full max-h-64 rounded-lg cursor-pointer transition-transform group-hover:scale-105 shadow-md"
                                  onClick={() => window.open(getFileUrl(attachment.url), '_blank')}
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 rounded-lg flex items-center justify-center">
                                  <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                </div>
                              </div>
                            ) : (
                              <div className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:shadow-lg cursor-pointer ${
                                isOwnMessage 
                                  ? 'border-white/30 bg-white/10 backdrop-blur-sm hover:bg-white/20' 
                                  : 'border-blue-200 dark:border-blue-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-800/30 dark:hover:to-cyan-800/30'
                              }`}>
                                <div className="flex items-center p-4">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mr-4 shadow-lg group-hover:scale-110 transition-transform duration-200 ${
                                    isOwnMessage 
                                      ? 'bg-white/30 backdrop-blur-sm' 
                                      : 'bg-gradient-to-br from-blue-500 to-cyan-600'
                                  }`}>
                                    <svg className={`w-6 h-6 ${isOwnMessage ? 'text-white' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <a
                                      href={getFileUrl(attachment.url)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`block text-sm font-semibold truncate mb-1 group-hover:text-blue-600 transition-colors ${
                                        isOwnMessage ? 'text-white hover:text-blue-200' : 'text-blue-700 dark:text-blue-300'
                                      }`}
                                    >
                                      {attachment.originalName || attachment.name || attachment.filename}
                                    </a>
                                    <div className="flex items-center justify-between">
                                      <span className={`text-xs ${isOwnMessage ? 'text-white/80' : 'text-blue-600/80 dark:text-blue-400/80'}`}>
                                        Click to download
                                      </span>
                                      <svg className={`w-4 h-4 group-hover:translate-x-1 transition-transform ${isOwnMessage ? 'text-white/70' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                                <div className={`absolute inset-0 pointer-events-none ${
                                  isOwnMessage 
                                    ? 'bg-gradient-to-r from-transparent via-white/5 to-transparent' 
                                    : 'bg-gradient-to-r from-transparent via-blue-200/20 to-transparent'
                                } transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000`}></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {message.content && (
                      <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                    )}
                    
                    <div className={`flex items-center justify-end mt-2 space-x-1`}>
                      <p className={`text-xs ${
                        isOwnMessage ? 'text-white/80' : 'text-[#6B7280] dark:text-gray-400'
                      }`}>
                        {formatTime(message.createdAt)}
                      </p>
                      {isOwnMessage && (
                        <div className="flex space-x-1">
                          <svg className="w-3 h-3 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing Indicator */}
        {typingUsers.size > 0 && (
          <div className="flex justify-start animate-fadeIn">
            <div className="bg-white dark:bg-gray-700 text-[#111827] dark:text-[#F3F4F6] rounded-2xl rounded-bl-md px-4 py-3 max-w-xs shadow-lg border border-gray-200 dark:border-gray-600">
              <div className="flex space-x-1 mb-2">
                <div className="w-2 h-2 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
              <p className="text-xs text-[#6B7280] dark:text-gray-400 font-medium">
                {chatInfo?.isGroupChat ? (
                  typingUsers.size === 1 ? 
                    `${Array.from(typingUsers)[0].userName} is typing...` :
                    `${Array.from(typingUsers).map(u => u.userName).join(', ')} are typing...`
                ) : (
                  `${otherUser?.name || 'Someone'} is typing...`
                )}
              </p>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-[#E5E7EB] dark:border-gray-700 px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-white dark:bg-gray-800 shadow-lg">
        {selectedFiles.length > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                <svg className="w-4 h-4 mr-2 text-[#6366F1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
              </h4>
              <button
                type="button"
                onClick={() => setSelectedFiles([])}
                className="text-xs text-gray-500 hover:text-red-500 transition-colors duration-200 font-medium"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => {
                const isImage = file.type.startsWith('image/');
                const fileSize = (file.size / 1024 / 1024).toFixed(2);
                
                return (
                  <div key={index} className="group relative bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-lg border-2 border-gray-100 dark:border-gray-700 hover:border-[#6366F1]/30 dark:hover:border-[#6366F1]/30 transition-all duration-300 hover:shadow-xl max-w-xs">
                    <div className="flex items-start space-x-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isImage 
                          ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
                          : 'bg-gradient-to-br from-[#6366F1] to-[#8B5CF6]'
                      } shadow-lg`}>
                        {isImage ? (
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {fileSize} MB • {file.type.split('/')[1]?.toUpperCase() || 'File'}
                        </p>
                        <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] h-1.5 rounded-full transition-all duration-300" style={{width: '100%'}}></div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 transform hover:scale-110"
                      title="Remove file"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="flex items-end space-x-2 sm:space-x-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
          />
          
          {/* Attachment Button */}
          <div className="relative group">
            <button
              type="button"
              onClick={handleAttachmentClick}
              className={`p-3 sm:p-3.5 rounded-2xl transition-all duration-300 shadow-lg flex-shrink-0 transform hover:scale-110 ${
                sending || uploading
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 text-[#6366F1] dark:text-indigo-300 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-gray-600 dark:hover:to-gray-500 border-2 border-blue-200 dark:border-gray-600 hover:border-[#6366F1]/50 hover:shadow-xl hover:shadow-blue-200/50 dark:hover:shadow-gray-900/50'
              }`}
              disabled={sending || uploading}
              title="Attach files (Images, PDFs, Documents)"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 animate-pulse"></div>
          </div>
          
          {/* Message Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              placeholder="Type a message..."
              className="w-full px-4 sm:px-6 py-3 sm:py-4 border-2 border-[#E5E7EB] dark:border-gray-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent bg-[#F8FAFC] dark:bg-gray-700 text-[#111827] dark:text-[#F3F4F6] placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200 shadow-sm text-sm sm:text-base"
              disabled={sending || uploading}
            />
            {(sending || uploading) && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#6366F1]"></div>
              </div>
            )}
          </div>
          
          {/* Send Button */}
          <button
            type="submit"
            disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending || uploading}
            className={`px-4 sm:px-6 py-3 sm:py-4 rounded-2xl font-bold transition-all duration-200 shadow-lg flex-shrink-0 ${
              (!newMessage.trim() && selectedFiles.length === 0) || sending || uploading
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white hover:from-[#5B56F0] hover:to-[#7C3AED] hover:scale-105 hover:shadow-xl transform'
            }`}
          >
            {sending || uploading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span className="hidden sm:inline text-sm">Sending...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-sm sm:text-base">Send</span>
                <svg className="w-4 h-4 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
            )}
          </button>
        </form>
        
        {uploading && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border-2 border-blue-200 dark:border-blue-800 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-200 dark:border-blue-700"></div>
                  <div className="animate-spin rounded-full h-8 w-8 border-t-3 border-blue-600 absolute top-0 left-0"></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Uploading files...</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70">Please wait while we process your files</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full animate-pulse" style={{width: '70%'}}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;