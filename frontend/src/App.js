// src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import FAQ from './components/FAQ';  // Import the FAQ component

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/faq" element={<FAQ />} />  {/* Add the FAQ route */}
        {/* Add more routes for other components as needed */}
      </Routes>
    </Router>
  );
}

export default App;
