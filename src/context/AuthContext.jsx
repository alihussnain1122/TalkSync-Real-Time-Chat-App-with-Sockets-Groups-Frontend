// AuthContext.jsx
import { createContext, useContext, useState } from "react";

// Create the context
const AuthContext = createContext();

// AuthProvider component
export const AuthProvider = ({ children }) => {
  // Safely initialize user state
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("chat-user");
      // Check if stored value exists and is not "null" or "undefined" strings
      const parsed = stored && stored !== "null" && stored !== "undefined" ? JSON.parse(stored) : null;

      // Optional: validate expected shape (e.g., must have _id)
      return parsed && parsed._id ? parsed : null;
    } catch (err) {
      console.error("❌ Failed to parse chat-user from localStorage:", err);
      return null;
    }
  });

  // Login function: sets localStorage and state
  const login = (userData) => {
    try {
      localStorage.setItem("chat-user", JSON.stringify(userData));
      setUser(userData);
    } catch (err) {
      console.error("❌ Failed to save chat-user to localStorage:", err);
    }
  };

  // Logout function: clears localStorage and state
  const logout = () => {
    localStorage.removeItem("chat-user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use AuthContext
export const useAuth = () => useContext(AuthContext);
