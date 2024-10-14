import React, { useState, useEffect } from 'react';
import './DocumentsView.css';
import { Link, useNavigate } from 'react-router-dom';

const DocumentsView = ({setAuth}) => {
  // Accept setAuth as a prop
  const [documents, setDocuments] = useState([]);
  const [searchText, setSearchText] = useState(''); // To capture user input
  const [filter, setFilter] = useState('file_name'); // Default filter is file_name
  const [showRateButton, setShowRateButton] = useState(null); // To track which file shows the Rate File button
  const [userRole, setUserRole] = useState(''); // Store user role
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch the documents from the backend
    const fetchDocuments = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/documents', {
          headers: {
            "jwt_token": token
          }
        });
        const data = await response.json();
        console.log(data);
        setDocuments(data);

        // Extract user role from token
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        setUserRole(decodedToken.user.role);
      } catch (error) {
        console.error('Error fetching documents:', error);
      }
    };

    fetchDocuments();
  }, []);


  const handleLogout = async () => {
    try {
      const response = await fetch("http://localhost:3000/logout", {
        method: "POST",
        headers: {
          "jwt_token": localStorage.getItem('token'),
        },
      });

      const parseRes = await response.json();
      if (response.ok) {
        localStorage.removeItem("token");
        setAuth(false);  // Update the authentication state
        navigate("/");  // Redirect to the LandingPage
      } else {
        alert(parseRes.msg || "Logout failed");
      }
    } catch (err) {
      console.error("Error logging out:", err.message);
    }
  };

  // Handle search functionality
  const handleSearch = (event) => {
    if (event.key === 'Enter') {
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
          {userRole && ['educator', 'moderator', 'admin'].includes(userRole) && (
            <Link to="/upload" className="upload-link">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px">
              <path d="M5 20h14v-2H5v2zm7-9l-5 5h3v4h4v-4h3l-5-5zm0-7v12h-2V4h2z"/>
            </svg>
              <span>File Upload</span>
            </Link>

           

            
            


          )}

<div onClick={handleLogout} style={{ cursor: 'pointer', marginLeft: '10px' }}>Logout</div>
 
          <Link to="/faq">
            <a>FAQ</a>
          </Link>

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
