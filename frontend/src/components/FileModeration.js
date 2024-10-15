import React, { useState, useEffect } from 'react';
import './DocumentsView.css'; // Reuse the same CSS as DocumentsView
import { Link, useNavigate } from 'react-router-dom';
import './FileModeration.css';

const FileModeration = ({ setAuth }) => {
  const [documents, setDocuments] = useState([]);
  const [showModerationButtons, setShowModerationButtons] = useState(null); // To toggle moderation buttons
  const [userRole, setUserRole] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showModerationDialog, setShowModerationDialog] = useState(false);
  const [moderationAction, setModerationAction] = useState(null); // 'approve' or 'reject'
  const [docToModerate, setDocToModerate] = useState(null);
  const navigate = useNavigate();

  // Fetch pending documents
  useEffect(() => {
    document.title = "Share2Teach"; // Set the tab name to "Share2Teach"
    
    const fetchPendingDocuments = async () => {
      try {
        const token = localStorage.getItem('token');
        let response;

        // Fetch only pending documents from /pending-documents
        response = await fetch('http://localhost:3000/pending-documents', {
          headers: {
            "Authorization": `Bearer ${token}`
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

        const data = await response.json();
        setDocuments(data);
      } catch (error) {
        console.error('Error fetching documents:', error);
        setIsAuthenticated(false);
      }
    };

    fetchPendingDocuments();
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

  const handleView = (path) => {
    window.open(path, '_blank');
  };

  const toggleModerationButtons = (fileId) => {
    setShowModerationButtons((prev) => (prev === fileId ? null : fileId));
  };

  const handleModerationAction = (fileId, action) => {
    setDocToModerate(fileId);
    setModerationAction(action);
    setShowModerationDialog(true);
  };

  const handleModerateDocument = async () => {
    try {
      setLoading(true);
      setLoadingMessage(`${moderationAction === 'approved' ? 'Approving' : 'Rejecting'} document...`);
      const res = await fetch('http://localhost:3000/moderate-document', {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "jwt_token": localStorage.getItem('token'),
        },
        body: JSON.stringify({
          file_id: docToModerate,
          action: moderationAction,
          comments: null, // Optional comments can be added if required
        }),
      });

      const data = await res.json();
      setLoading(false);
      setShowModerationDialog(false);

      if (res.ok) {
        setDocuments((prevDocs) =>
          prevDocs.map((doc) =>
            doc.file_id === docToModerate ? { ...doc, status: moderationAction } : doc
          )
        );
        alert(`Document ${moderationAction} successfully!`);
      } else {
        alert(data.msg || 'Failed to moderate document');
      }
    } catch (err) {
      console.error('Error moderating document:', err.message);
      setLoading(false);
      alert('Error moderating document');
    }
  };

  return (
    <div className="documents-page">
      <header className="header">
        <Link to="/"><h1 className="logo">Share2Teach</h1></Link>

        <nav className="nav">
          {userRole && ['moderator', 'admin'].includes(userRole) 
          }

          {isAuthenticated && (
            <div onClick={handleLogout} style={{ cursor: 'pointer', marginLeft: '10px' }}>Logout</div>
          )}
        </nav>
      </header>

      <table className="documents-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Status</th>
            <th></th> {/* Column for action buttons */}
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.file_id}>
              <td>{doc.file_name}</td>
              <td>{doc.status}</td>
              <td>
                <div className="action-container">
                  <button className="view-button" onClick={() => handleView(doc.storage_path)}>View</button>
                  <span className="three-dots" onClick={() => toggleModerationButtons(doc.file_id)}>&#x22EE;</span>
                  {showModerationButtons === doc.file_id && (
                    <>
                      <button className="approve-button" onClick={() => handleModerationAction(doc.file_id, 'approved')}>Approve</button>
                      <button className="reject-button" onClick={() => handleModerationAction(doc.file_id, 'rejected')}>Reject</button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Show loading dialog */}
      {loading && (
        <div className="loading-dialog">
          <div className="loading-content">
            <p>{loadingMessage}</p>
          </div>
        </div>
      )}

      {/* Show confirmation dialog for moderation */}
      {showModerationDialog && (
        <div className="confirm-moderation-dialog">
          <div className="confirm-moderation-content">
            <p>Are you sure you want to {moderationAction} this document?</p>
            <button onClick={handleModerateDocument}>Yes</button>
            <button onClick={() => setShowModerationDialog(false)}>No</button>
          </div>
        </div>
      )}

      <footer className="footer">
       
       
        <p className="copyright">Copyright 2024 Share2Teach</p>
      </footer>
    </div>
  );
};

export default FileModeration;
