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
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  
  // Refs for voice recording
  const typingTimerRef = useRef();
  const fileInputRef = useRef();
  const audioChunksRef = useRef([]);

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

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 } 
      });
      
      const options = { mimeType: 'audio/webm;codecs=opus' };
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/wav';
      }
      
      const recorder = new MediaRecorder(stream, options);
      
      recorder.onstart = () => {
        setIsRecording(true);
        audioChunksRef.current = [];
      };
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
        if (audioChunksRef.current.length > 0) {
          await sendVoiceNote(audioChunksRef.current);
        }
      };
      
      setMediaRecorder(recorder);
      recorder.start(1000);
    } catch (err) {
      setError('Unable to access microphone. Please check your permissions.',err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  };

  const sendVoiceNote = async (chunks) => {
    if (!chunks || chunks.length === 0) return;
    
    try {
      setSending(true);
      const audioBlob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
      const formData = new FormData();
      formData.append('files', audioBlob, `voice-note-${Date.now()}.webm`);
      
      const uploadRes = await axios.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const messageData = {
        chatId,
        content: '',
        attachments: uploadRes.data.files.map(file => ({
          ...file,
          type: 'voice'
        }))
      };
      
      const res = await axios.post('/message', messageData);
      setMessages(prev => [...prev, res.data]);
      
      if (socket?.current && chatInfo) {
        socket.current.emit('new message', {
          ...res.data,
          chat: chatInfo
        });
      }
      
      audioChunksRef.current = [];
      setMediaRecorder(null);
    } catch (err) {
      setError(`Failed to send voice note: ${err.response?.data?.message || err.message}`);
    } finally {
      setSending(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
    }
    audioChunksRef.current = [];
    setMediaRecorder(null);
    setIsRecording(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#F9FAFB] dark:bg-[#1F2937]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366F1] mx-auto mb-4"></div>
          <p className="text-[#6B7280] dark:text-[#E5E7EB]">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !chatInfo) {
    return (
      <div className="p-6 bg-[#F9FAFB] dark:bg-[#1F2937] min-h-screen">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
          <p className="font-medium">Error</p>
          <p>{error}</p>
          <button 
            onClick={() => navigate('/chats')} 
            className="mt-2 bg-[#6366F1] text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
          >
            Back to Chats
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white dark:bg-gray-800">
      {/* Chat Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-[#E5E7EB] dark:border-gray-700 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/chats')}
            className="mr-4 p-2 hover:bg-[#E0E7FF] dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-[#6366F1] dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center">
            <div className={`w-10 h-10 ${chatInfo?.isGroupChat ? 'bg-[#F472B6]' : 'bg-[#6366F1]'} rounded-full flex items-center justify-center text-white font-medium mr-3 relative`}>
              {chatInfo?.isGroupChat ? 
                (chatInfo.chatName?.charAt(0)?.toUpperCase() || 'G') :
                (otherUser?.name?.charAt(0)?.toUpperCase() || '?')
              }
              {chatInfo?.isGroupChat && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center">
                  <svg className="w-2 h-2 text-[#F472B6]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#111827] dark:text-[#F3F4F6]">
                {chatInfo?.isGroupChat ? 
                  (chatInfo.chatName || 'Group Chat') :
                  (otherUser?.name || 'Unknown User')
                }
              </h1>
              <p className="text-sm text-[#6B7280] dark:text-gray-400">
                {chatInfo?.isGroupChat ? 
                  `${chatInfo.users?.length || 0} members` :
                  otherUser?.email
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F9FAFB] dark:bg-gray-700/30">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-[#6B7280] dark:text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-[#111827] dark:text-[#F3F4F6] mb-2">No messages yet</h3>
            <p className="text-[#6B7280] dark:text-gray-400">Start the conversation by sending a message below.</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.sender._id === user._id;
            return (
              <div
                key={message._id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isOwnMessage
                      ? 'bg-[#6366F1] text-white rounded-br-none'
                      : 'bg-[#E0E7FF] dark:bg-gray-600 text-[#111827] dark:text-[#F3F4F6] rounded-bl-none'
                  }`}
                >
                  {chatInfo?.isGroupChat && !isOwnMessage && (
                    <p className="text-xs font-semibold mb-1 text-[#6366F1] dark:text-indigo-300">
                      {message.sender.name}
                    </p>
                  )}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mb-2">
                      {message.attachments.map((attachment, index) => (
                        <div key={index} className="mb-2">
                          {attachment.type === 'image' ? (
                            <img
                              src={getFileUrl(attachment.url)}
                              alt="Attachment"
                              className="max-w-full rounded cursor-pointer hover:opacity-90"
                              onClick={() => window.open(getFileUrl(attachment.url), '_blank')}
                            />
                          ) : attachment.type === 'voice' ? (
                            <div className={`flex items-center p-2 rounded border ${
                              isOwnMessage ? 'border-indigo-300 bg-indigo-400' : 'border-[#C7D2FE] dark:border-gray-500 bg-[#E0E7FF] dark:bg-gray-600'
                            }`}>
                              <svg className="w-5 h-5 mr-2 text-[#6366F1] dark:text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                              <audio 
                                controls 
                                className="flex-1"
                                style={{ height: '32px' }}
                                preload="metadata"
                              >
                                <source src={getFileUrl(attachment.url)} type={attachment.mimetype || 'audio/webm'} />
                                <source src={getFileUrl(attachment.url)} type="audio/wav" />
                                <source src={getFileUrl(attachment.url)} type="audio/mpeg" />
                              </audio>
                            </div>
                          ) : (
                            <div className={`flex items-center p-2 rounded border ${
                              isOwnMessage ? 'border-indigo-300 bg-indigo-400' : 'border-[#C7D2FE] dark:border-gray-500 bg-[#E0E7FF] dark:bg-gray-600'
                            }`}>
                              <svg className="w-5 h-5 mr-2 text-[#6366F1] dark:text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              <a
                                href={getFileUrl(attachment.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-sm truncate ${isOwnMessage ? 'text-blue-100' : 'text-[#6366F1] dark:text-indigo-300'}`}
                              >
                                {attachment.originalName || attachment.name || attachment.filename}
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {message.content && (
                    <p className="text-sm">{message.content}</p>
                  )}
                  
                  <p
                    className={`text-xs mt-1 ${
                      isOwnMessage ? 'text-blue-100' : 'text-[#6B7280] dark:text-gray-400'
                    }`}
                  >
                    {formatTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing Indicator */}
        {typingUsers.size > 0 && (
          <div className="flex justify-start">
            <div className="bg-[#E0E7FF] dark:bg-gray-600 text-[#111827] dark:text-[#F3F4F6] rounded-lg rounded-bl-none px-4 py-2 max-w-xs">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-[#6366F1] dark:bg-indigo-300 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-[#6366F1] dark:bg-indigo-300 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-[#6366F1] dark:bg-indigo-300 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
              <p className="text-xs text-[#6B7280] dark:text-gray-400 mt-1">
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
      <div className="border-t border-[#E5E7EB] dark:border-gray-700 px-6 py-4 bg-white dark:bg-gray-800">
        {selectedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center bg-[#E0E7FF] dark:bg-gray-700 rounded-lg p-2 text-sm">
                <svg className="w-4 h-4 mr-2 text-[#6366F1] dark:text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="truncate max-w-xs text-[#111827] dark:text-[#F3F4F6]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="ml-2 text-[#6B7280] dark:text-gray-400 hover:text-[#F472B6] dark:hover:text-[#F472B6]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
          />
          
          <button
            type="button"
            onClick={handleAttachmentClick}
            className="p-2 text-[#6B7280] dark:text-gray-400 hover:text-[#6366F1] dark:hover:text-indigo-300 hover:bg-[#E0E7FF] dark:hover:bg-gray-700 rounded-full transition-colors"
            disabled={sending || uploading || isRecording}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              className="p-2 text-[#6B7280] dark:text-gray-400 hover:text-[#6366F1] dark:hover:text-indigo-300 hover:bg-[#E0E7FF] dark:hover:bg-gray-700 rounded-full transition-colors"
              disabled={sending || uploading}
              title="Record voice note"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-2 text-[#F472B6] hover:bg-[#F472B6]/10 rounded-full transition-colors"
                title="Cancel recording"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                type="button"
                onClick={stopRecording}
                className="p-2 text-[#6366F1] dark:text-indigo-300 hover:bg-[#6366F1]/10 dark:hover:bg-indigo-300/10 rounded-full animate-pulse"
                title="Stop recording"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            </div>
          )}
          
          <div className="flex-1">
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              placeholder="Type a message..."
              className="w-full px-4 py-2 border border-[#E5E7EB] dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent bg-white dark:bg-gray-700 text-[#111827] dark:text-[#F3F4F6]"
              disabled={sending || uploading}
            />
          </div>
          
          <button
            type="submit"
            disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending || uploading}
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              (!newMessage.trim() && selectedFiles.length === 0) || sending || uploading
                ? 'bg-[#E5E7EB] dark:bg-gray-700 text-[#6B7280] dark:text-gray-400 cursor-not-allowed'
                : 'bg-[#6366F1] text-white hover:bg-indigo-700'
            }`}
          >
            {sending || uploading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              'Send'
            )}
          </button>
        </form>
        
        {uploading && (
          <div className="mt-2 text-sm text-[#6B7280] dark:text-gray-400">
            Uploading files...
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;