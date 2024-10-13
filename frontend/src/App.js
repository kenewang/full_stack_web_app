// src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import FAQ from './components/FAQ';  // Import the FAQ component
import DocumentsView from './components/DocumentsView'; // Import the DocumentsView component
import SearchResults from './components/SearchResults';
import RateDocument from './components/RateDocument'; // Ensure the path is correct


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/faq" element={<FAQ />} />  {/* Add the FAQ route */}
        <Route path="/documents" element={<DocumentsView />} />  {/* Add the documents view route */}
        <Route path="/search-results" element={<SearchResults />} />
        <Route path="/rate-document/:file_id" element={<RateDocument />} /> 
        {/* Add more routes for other components as needed */}
      </Routes>
    </Router>
  );
}

export default App;
