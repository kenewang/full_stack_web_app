// src/App.js
import React, { Fragment, useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import FAQ from './components/FAQ';  
import DocumentsView from './components/DocumentsView'; 
import SearchResults from './components/SearchResults';
import RateDocument from './components/RateDocument'; 
import Register from './components/Register';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import FileUpload from './components/FileUpload';
import FileModeration from './components/FileModeration'; // Import FileModeration
import Reports from './components/Reports'; // Import the Reports component

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const setAuth = (boolean) => {
    setIsAuthenticated(boolean);
  };

  return (
    <Fragment>
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={<LandingPage isAuthenticated={isAuthenticated} setAuth={setAuth} />} 
          />
          <Route 
            path="/faq" 
            element={<FAQ isAuthenticated={isAuthenticated} setAuth={setAuth} />}  
          />
          <Route path="/documents" element={<DocumentsView setAuth={setAuth} />} />
          <Route path="/search-results" element={<SearchResults />} />
          <Route path="/rate-document/:file_id" element={<RateDocument />} />
          <Route path="/register" element={<Register setAuth={setAuth} />} />
          <Route path="/login" element={<Login setAuth={setAuth} />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/upload" element={<FileUpload />} />
          {/* Add the FileModeration route */}
          <Route path="/file-moderation" element={<FileModeration setAuth={setAuth} />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Router>
    </Fragment>
  );
}

export default App;
