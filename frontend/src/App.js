// src/App.js
import React, { Fragment, useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import FAQ from './components/FAQ';  
import DocumentsView from './components/DocumentsView'; 
import SearchResults from './components/SearchResults';
import RateDocument from './components/RateDocument'; 
import Register from './components/Register';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  // Check token on component mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  // Function to update authentication status
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
            element={<FAQ isAuthenticated={isAuthenticated} />}  // Pass isAuthenticated
          />  
          <Route path="/documents" element={<DocumentsView />} />
          <Route path="/search-results" element={<SearchResults />} />
          <Route path="/rate-document/:file_id" element={<RateDocument />} />

          <Route 
            path="/register" 
            element={<Register setAuth={setAuth} />} 
          />
        </Routes>
      </Router>
    </Fragment>
  );
}

export default App;
