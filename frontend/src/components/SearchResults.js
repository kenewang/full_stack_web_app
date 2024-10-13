import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import './SearchResults.css';

const SearchResults = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [showRateButton, setShowRateButton] = useState(null); // Track which file shows the Rate File button
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSearchResults = async () => {
      try {
        const query = searchParams.toString();
        const response = await fetch(`http://localhost:3000/search-documents?${query}`);
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error('Error fetching search results:', error);
      }
    };

    fetchSearchResults();
  }, [location.search]);

  const handleView = (path) => {
    window.open(path, '_blank'); // Open document in a new tab
  };

  const toggleRateButton = (fileId) => {
    setShowRateButton((prev) => (prev === fileId ? null : fileId)); // Toggle display of Rate File button
  };

  const handleRate = (fileId) => {
    navigate(`/rate-document/${fileId}`); // Redirect to the rate document page
  };

  return (
    <div className="search-results-page">
      <header className="header">
        <Link to="/"><h1 className="logo">Share2Teach</h1></Link>
        <nav className="nav">
          <Link to="/faq" className="faq-link">FAQ</Link>
        </nav>
      </header>

      <div className="search-results-container">
        <h2 className="search-title">Search Results</h2>
        {searchResults.length > 0 ? (
          searchResults.map((doc) => (
            <div key={doc.file_id} className="result-item">
              <p className="file-name">{doc.file_name}</p>
              <div className="action-container">
                <button className="view-button" onClick={() => handleView(doc.storage_path)}>
                  View
                </button>
                <span className="three-dots" onClick={() => toggleRateButton(doc.file_id)}>&#x22EE;</span>
                {showRateButton === doc.file_id && (
                  <button className="rate-button" onClick={() => handleRate(doc.file_id)}>Rate File</button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p>No results found.</p>
        )}
      </div>
      <footer className="footer">
        <button className="contact-us">Contact Us</button>
        <div className="social-media-icons">Social Media Icons</div>
        <p className="copyright">Copyright 2024 Share2Teach</p>
      </footer>
    </div>
  );
};

export default SearchResults;
