import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import { Link } from 'react-router-dom';

export default function VerifyEmail() {
  const { token } = useParams();
  const [msg, setMsg] = useState('Verifying your email...');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const verify = async () => {
      try {
        setIsLoading(true);
        const res = await axios.get(`/auth/verify/${token}`);
        setMsg(res.data.message || 'Email verified successfully!');
        setIsSuccess(true);
        setTimeout(() => navigate('/'), 3000);
      } catch (err) {
        setMsg(err.response?.data?.message || 'Invalid or expired token.');
        setIsSuccess(false);
      } finally {
        setIsLoading(false);
      }
    };
    verify();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] dark:bg-[#1F2937] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden transition-colors duration-300">
          {/* Header */}
          <div className="bg-[#6366F1] px-8 py-6">
            <h2 className="text-3xl font-bold text-white text-center">TalkSync</h2>
            <p className="text-indigo-200 text-center mt-2">Email Verification</p>
          </div>

          {/* Content */}
          <div className="p-8 text-center">
            {isLoading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366F1] mb-4"></div>
                <p className="text-[#6B7280] dark:text-gray-400">{msg}</p>
              </div>
            ) : (
              <>
                <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${isSuccess ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'} mb-4`}>
                  {isSuccess ? (
                    <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <h3 className={`text-lg font-medium mb-2 ${isSuccess ? 'text-[#111827] dark:text-[#F3F4F6]' : 'text-[#111827] dark:text-[#F3F4F6]'}`}>
                  {isSuccess ? 'Verification Successful!' : 'Verification Failed'}
                </h3>
                <p className="text-[#6B7280] dark:text-gray-400 mb-6">{msg}</p>
                
                {isSuccess ? (
                  <p className="text-sm text-[#6B7280] dark:text-gray-400">Redirecting you to the login page...</p>
                ) : (
                  <Link 
                    to="/" 
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#6366F1] hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Return to Home
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}