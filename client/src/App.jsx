import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import UserApp from './pages/UserApp';

const Landing = () => (
  <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-8">
    <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
      Smart Tourist Safety
    </h1>
    <div className="flex gap-6">
      <Link to="/admin" className="px-8 py-4 bg-blue-600 rounded-xl font-bold hover:bg-blue-700 transition transform hover:scale-105">
        Admin Dashboard
      </Link>
      <Link to="/user" className="px-8 py-4 bg-emerald-600 rounded-xl font-bold hover:bg-emerald-700 transition transform hover:scale-105">
        User App
      </Link>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/user" element={<UserApp />} />
      </Routes>
    </Router>
  );
}

export default App;
