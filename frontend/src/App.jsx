import React, { useState } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const savedUser = localStorage.getItem('user');
  const savedToken = localStorage.getItem('token');
  const initialUser = savedUser && savedToken ? JSON.parse(savedUser) : null;
  const [authMode, setAuthMode] = useState(initialUser ? 'dashboard' : 'login'); // 'login', 'register', or 'dashboard'
  const [user, setUser] = useState(initialUser);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setAuthMode('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setAuthMode('login');
  };

  const toggleAuthMode = () => {
    if (authMode === 'login') {
      setAuthMode('register');
    } else {
      setAuthMode('login');
    }
  };

  if (authMode === 'dashboard' && user) {
    return <Dashboard user={user} onLogout={handleLogout} />;
  }

  return (
    <div className="App">
      {authMode === 'login' ? (
        <Login onSuccess={handleLoginSuccess} onToggleMode={toggleAuthMode} />
      ) : (
        <Register onSuccess={toggleAuthMode} onToggleMode={toggleAuthMode} />
      )}
    </div>
  );
}

export default App;
