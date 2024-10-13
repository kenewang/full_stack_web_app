import React, { useState, useEffect } from 'react';
import './DocumentsView.css';
import { Link, useNavigate } from 'react-router-dom';

const DocumentsView = () => {
  const [documents, setDocuments] = useState([]);
  const [searchText, setSearchText] = useState(''); // To capture user input
  const [filter, setFilter] = useState('file_name'); // Default filter is file_name
  const [showRateButton, setShowRateButton] = useState(null); // To track which file shows the Rate File button
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch the documents from the backend
    const fetchDocuments = async () => {
      try {
        const response = await fetch('http://localhost:3000/documents'); // Adjust to match your backend route
        const data = await response.json();
        console.log(data); // Log the data to check what is being returned
        setDocuments(data);
      } catch (error) {
        console.error('Error fetching documents:', error);
      }
    };

    fetchDocuments();
  }, []);

  // Handle search functionality
  const handleSearch = (event) => {
    if (event.key === 'Enter') {
      // Perform search and redirect to results page with query params
      const queryParams = new URLSearchParams({
        [filter]: searchText, // Set the filter dynamically based on dropdown
      });
      navigate(`/search-results?${queryParams.toString()}`);
    }
  };

  const handleView = (path) => {
    window.open(path, '_blank'); // Open the document in a new tab
  };

  const toggleRateButton = (fileId) => {
    setShowRateButton((prev) => (prev === fileId ? null : fileId)); // Toggle display of Rate File button
  };

  const handleRate = (fileId) => {
    navigate(`/rate-document/${fileId}`); // Redirect to the rate document page
  };

  return (
    <div className="documents-page">
      <header className="header">
        <Link to="/"><h1 className="logo">Share2Teach</h1></Link>

        <nav className="nav">
          <Link to="/faq">
            <a>FAQ</a>
          </Link>

          {/* Dropdown for selecting search filter */}
          <select 
            className="search-filter" 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="file_name">File Name</option>
            <option value="subject_name">Subject Name</option>
            <option value="grade_name">Grade Name</option>
            <option value="rating">Rating</option>
            <option value="uploaded_by">Uploaded By</option>
            <option value="status">Status</option>
            <option value="keywords">Keywords</option>
          </select>

          {/* Search bar */}
          <input 
            type="text" 
            placeholder="Search document" 
            className="search-bar"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleSearch}
          />
        </nav>
      </header>

      <table className="documents-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Grade</th>
            <th>File Name</th>
            <th>Rating</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.file_id}>
              <td>{doc.subject_name}</td>
              <td>{doc.grade_name}</td>
              <td>{doc.file_name}</td>
              <td>{doc.rating}</td>
              <td>
                <div className="action-container">
                  <button className="view-button" onClick={() => handleView(doc.storage_path)}>View</button>
                  <span className="three-dots" onClick={() => toggleRateButton(doc.file_id)}>&#x22EE;</span>
                  {showRateButton === doc.file_id && (
                    <button className="rate-button" onClick={() => handleRate(doc.file_id)}>Rate File</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="footer">
        <button className="contact-us">Contact Us</button>
        <div className="social-media-icons">Social Media Icons</div>
        <p className="copyright">Copyright 2024 Share2Teach</p>
      </footer>
    </div>
  );
};

export default DocumentsView;
