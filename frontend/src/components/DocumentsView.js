import React, { useState, useEffect } from 'react';
import './DocumentsView.css';
import { Link, useNavigate } from 'react-router-dom';

const DocumentsView = ({ setAuth }) => {
  const [documents, setDocuments] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState('file_name');
  const [showRateButton, setShowRateButton] = useState(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [fileToReport, setFileToReport] = useState(null); // Track the file being reported
  const [userRole, setUserRole] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Share2Teach"; // Set the tab name to "Share2Teach"
    const fetchDocuments = async () => {
      try {
        const token = localStorage.getItem('token');
        let response;

        if (token) {
          response = await fetch('http://localhost:3000/documents', {
            headers: {
              "jwt_token": token
            }
          });

          if (response.status === 403 || response.status === 401) {
            localStorage.removeItem('token');
            setAuth(false);
            setIsAuthenticated(false);
            navigate("/login");
            return;
          }

          const decodedToken = JSON.parse(atob(token.split('.')[1]));
          setUserRole(decodedToken.user.role);
          setIsAuthenticated(true);
        } else {
          response = await fetch('http://localhost:3000/documents');
          setIsAuthenticated(false);
        }

        const data = await response.json();
        setDocuments(data);
      } catch (error) {
        console.error('Error fetching documents:', error);
        setIsAuthenticated(false);
      }
    };

    fetchDocuments();
  }, [setAuth, navigate]);

  const handleLogout = async () => {
    try {
      const response = await fetch("http://localhost:3000/logout", {
        method: "POST",
        headers: {
          "jwt_token": localStorage.getItem('token'),
        },
      });

      if (response.ok) {
        localStorage.removeItem("token");
        setAuth(false);
        setIsAuthenticated(false);
        navigate("/");
      } else {
        const parseRes = await response.json();
        alert(parseRes.msg || "Logout failed");
      }
    } catch (err) {
      console.error("Error logging out:", err.message);
    }
  };

  const handleSearch = (event) => {
    if (event.key === 'Enter') {
      const queryParams = new URLSearchParams({
        [filter]: searchText,
      });
      navigate(`/search-results?${queryParams.toString()}`);
    }
  };

  const handleView = (path) => {
    window.open(path, '_blank');
  };

  const toggleRateButton = (fileId) => {
    setShowRateButton((prev) => (prev === fileId ? null : fileId));
  };

  const handleRate = (fileId) => {
    navigate(`/rate-document/${fileId}`);
  };

  const handleConvertToPDF = async (fileId) => {
    try {
      setLoading(true);
      setLoadingMessage('Converting document to PDF...');
      const res = await fetch(`http://localhost:3000/convert-to-pdf/${fileId}`);
      const data = await res.json();
      setLoading(false);

      if (res.ok && data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      } else {
        alert("Failed to convert document to PDF");
      }
    } catch (err) {
      console.error("Error converting to PDF:", err.message);
      setLoading(false);
      alert("Error converting document to PDF");
    }
  };

  const handleDeleteDocument = async () => {
    try {
      setLoading(true);
      setLoadingMessage('Deleting document...');
      const res = await fetch(`http://localhost:3000/documents/${docToDelete}`, {
        method: 'DELETE',
        headers: {
          "jwt_token": localStorage.getItem('token'),
        },
      });
      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setDocuments(documents.filter(doc => doc.file_id !== docToDelete));
        alert("Document deleted successfully");
      } else {
        alert(data.message || "Error deleting document");
      }
      setShowConfirmDelete(false);
    } catch (err) {
      console.error("Error deleting document:", err.message);
      setLoading(false);
      setShowConfirmDelete(false);
      alert("Error deleting document");
    }
  };

  const confirmDeleteDocument = (fileId) => {
    setDocToDelete(fileId);
    setShowConfirmDelete(true);
  };

  // Handle the "Report" action
  const handleReport = (fileId) => {
    setFileToReport(fileId);
    setShowReportDialog(true);
  };

  // Submit the report to the backend
  const submitReport = async () => {
    try {
      const res = await fetch("http://localhost:3000/report-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "jwt_token": localStorage.getItem('token'),
        },
        body: JSON.stringify({
          file_id: fileToReport,
          reason: reportReason,
        }),
      });
      
      const data = await res.json();
      setShowReportDialog(false);
      setReportReason(''); // Reset the reason input

      if (res.ok) {
        alert("Report submitted successfully!");
      } else {
        alert(data.msg || "Failed to submit report");
      }
    } catch (err) {
      console.error("Error reporting document:", err.message);
      alert("Error reporting document");
    }
  };

  return (
    <div className="documents-page">
      <header className="header">
        <Link to="/"><h1 className="logo">Share2Teach</h1></Link>

        <nav className="nav">
          {/* Conditionally render File Upload link and File Moderation link */}
          {userRole && ['educator', 'moderator', 'admin'].includes(userRole) && (
            <>
              {['moderator', 'admin'].includes(userRole) && (
                <>
                  <Link to="/file-moderation" className="moderation-link">
                    <span>File Moderation</span>
                  </Link>
                  {/* Add Reports link for admins and moderators */}
                  <Link to="/reports" className="reports-link">
                    <span>Reports</span>
                  </Link>
                </>
              )}
              
              <Link to="/upload" className="upload-link">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px">
                  <path d="M5 20h14v-2H5v2zm7-9l-5 5h3v4h4v-4h3l-5-5zm0-7v12h-2V4h2z"/>
                </svg>
                <span>File Upload</span>
              </Link>
            </>
          )}

          {/* Render Analytics for Admins only and replace FAQ */}
          {userRole === 'admin' ? (
            <Link to="/analytics">Analytics</Link>
          ) : (
            <Link to="/faq">FAQ</Link>
          )}

          {isAuthenticated && (
            <div onClick={handleLogout} style={{ cursor: 'pointer', marginLeft: '10px' }}>Logout</div>
          )}

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
                    <>
                      <button className="rate-button" onClick={() => handleRate(doc.file_id)}>Rate File</button>
                      <button className="convert-button" onClick={() => handleConvertToPDF(doc.file_id)}>Convert to PDF</button>
                      {isAuthenticated && ['open-access', 'educator'].includes(userRole) && (
                        <button className="report-button" onClick={() => handleReport(doc.file_id)}>Report</button>
                      )}
                      {isAuthenticated && ['admin', 'moderator', 'educator'].includes(userRole) && (
                        <button className="delete-button" onClick={() => confirmDeleteDocument(doc.file_id)}>Delete</button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Show the loading dialog */}
      {loading && (
        <div className="loading-dialog">
          <div className="loading-content">
            <p>{loadingMessage}</p>
          </div>
        </div>
      )}

      {/* Show confirmation dialog for delete */}
      {showConfirmDelete && (
        <div className="confirm-delete-dialog">
          <div className="confirm-delete-content">
            <p>Are you sure you want to delete this document?</p>
            <button onClick={handleDeleteDocument}>Yes</button>
            <button onClick={() => setShowConfirmDelete(false)}>No</button>
          </div>
        </div>
      )}

      {/* Show report dialog */}
      {showReportDialog && (
        <div className="report-dialog">
          <div className="report-content">
            <h3>Report Document</h3>
            <label htmlFor="report-reason">Reason:</label>
            <textarea 
              id="report-reason" 
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Enter your reason for reporting this document"
            ></textarea>
            <button onClick={submitReport}>Submit Report</button>
            <button onClick={() => setShowReportDialog(false)}>Cancel</button>
          </div>
        </div>
      )}

       
<footer className="footer">
  {/* Use 'mailto' to open the email client */}
  <a href="mailto:share2teach@gmail.com">
    <button className="contact-us">Contact Us</button>
  </a>
  <div className="social-media-icons">
    <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer">
      <i className="fab fa-facebook-f"></i>
    </a>
    <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer">
      <i className="fab fa-instagram"></i>
    </a>
    <a href="https://www.twitter.com" target="_blank" rel="noopener noreferrer">
      <i className="fab fa-twitter"></i>
    </a>
  </div>
  <p className="copyright">Copyright 2024 Share2Teach</p>
</footer>

    </div>
  );
};

export default DocumentsView;
