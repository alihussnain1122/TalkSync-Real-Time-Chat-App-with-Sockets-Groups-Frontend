import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import { Link } from 'react-router-dom';

export default function VerifyEmail() {
  const { token } = useParams(); // Only token from URL params
  const location = useLocation();
  const [msg, setMsg] = useState('Verifying your email...');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(8);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we're coming from a redirect with status and message in query params
    const urlParams = new URLSearchParams(location.search);
    const statusFromUrl = urlParams.get('status');
    const messageFromUrl = urlParams.get('message');
    
    if (statusFromUrl === 'success') {
      setMsg(messageFromUrl || 'Your email has been successfully verified! You can now access all features of TalkSync.');
      setIsSuccess(true);
      setIsLoading(false);
      
      // Start countdown for redirect
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else if (statusFromUrl === 'error') {
      setMsg(messageFromUrl || 'The verification link is invalid or has expired. Please request a new verification email.');
      setIsSuccess(false);
      setIsLoading(false);
    } else if (token) {
      // Legacy token verification for direct API calls
      const verify = async () => {
        try {
          setIsLoading(true);
          const res = await axios.get(`/auth/verify/${token}`);
          setMsg(res.data.message || 'Your email has been successfully verified! You can now access all features of TalkSync.');
          setIsSuccess(true);
          
          // Start countdown
          const timer = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(timer);
                navigate('/');
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          return () => clearInterval(timer);
        } catch (err) {
          setMsg(err.response?.data?.message || 'The verification link is invalid or has expired. Please request a new verification email.');
          setIsSuccess(false);
        } finally {
          setIsLoading(false);
        }
      };
      verify();
    } else {
      // No token or status provided
      setMsg('Invalid verification link. Please check your email for the correct verification link.');
      setIsSuccess(false);
      setIsLoading(false);
    }
  }, [token, location.search, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 opacity-10 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 rounded-full bg-gradient-to-br from-blue-400 to-cyan-600 opacity-10 blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-lg">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 overflow-hidden transition-all duration-500 hover:shadow-3xl">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 px-8 py-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative">
              <div className="flex items-center justify-center mb-2">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white text-center tracking-tight">TalkSync</h1>
              <p className="text-white/80 text-center mt-2 font-medium">Email Verification</p>
            </div>
          </div>

          {/* Content */}
          <div className="p-10 text-center">
            {isLoading ? (
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 dark:border-gray-700"></div>
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent absolute top-0 left-0"></div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Verifying Your Email</h3>
                  <p className="text-gray-600 dark:text-gray-400">{msg}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className={`mx-auto flex items-center justify-center h-20 w-20 rounded-full mb-6 ${
                    isSuccess 
                      ? 'bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg shadow-green-500/25' 
                      : 'bg-gradient-to-br from-red-400 to-red-600 shadow-lg shadow-red-500/25'
                  } transition-all duration-500`}>
                    {isSuccess ? (
                      <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  
                  <h2 className={`text-2xl font-bold mb-3 ${
                    isSuccess ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'
                  }`}>
                    {isSuccess ? 'Email Verified Successfully!' : 'Verification Failed'}
                  </h2>
                  
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed max-w-sm mx-auto">
                    {msg}
                  </p>
                </div>
                
                {isSuccess ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                      <div className="flex items-center justify-center space-x-2 text-green-700 dark:text-green-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">
                          Redirecting to login in {countdown} second{countdown !== 1 ? 's' : ''}...
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link 
                        to="/" 
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        Go to Login
                      </Link>
                      
                      <Link 
                        to="/chats" 
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-500/50"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Start Chatting
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                      <p className="text-red-700 dark:text-red-400 font-medium">
                        Need help? Contact our support team for assistance.
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link 
                        to="/" 
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-gray-500/50"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Return Home
                      </Link>
                      
                      <Link 
                        to="/register" 
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Try Again
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            © 2025 TalkSync. Secure communication made simple.
          </p>
        </div>
      </div>
    </div>
  );
}