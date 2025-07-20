// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chats from './pages/Chats';
import ChatPage from './pages/ChatPage';
import VerifyEmail from './pages/VerifyEmail';

import { useAuth } from './context/AuthContext';
import { Navigate } from 'react-router-dom';

function App() {
  const { user } = useAuth();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify/:token" element={<VerifyEmail />} />
        <Route path="/verify-email/:status" element={<VerifyEmail />} />
        <Route path="/chats" element={user ? <Chats /> : <Navigate to="/" />} />
        <Route path="/chats/:chatId" element={user ? <ChatPage /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
