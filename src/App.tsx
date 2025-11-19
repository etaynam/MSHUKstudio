import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './pages/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import LibraryPage from './pages/LibraryPage';
import SuppliersPage from './pages/SuppliersPage';
import AiStudioPage from './pages/AiStudioPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard/*" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="ai-studio" element={<AiStudioPage />} />
      </Route>
    </Routes>
  );
}

export default App;
