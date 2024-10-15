import React, { useState, useEffect } from 'react';
import './DocumentsView.css'; // Reuse the same CSS as DocumentsView
import { Link, useNavigate } from 'react-router-dom';
import './Reports.css'; // Custom styles for reports if necessary

const Reports = ({ setAuth }) => {
  const [reports, setReports] = useState([]);
  const [showModerationButtons, setShowModerationButtons] = useState(null); // Track which report shows moderation buttons
  const [userRole, setUserRole] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const navigate = useNavigate();

  // Fetch pending reports
  useEffect(() => {
    document.title = "Share2Teach"; // Set the tab name to "Share2Teach"
    const fetchReports = async () => {
      try {
        const token = localStorage.getItem('token');
        let response;

        response = await fetch('http://localhost:3000/reports', {
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

        const data = await response.json();
        setReports(data);
      } catch (error) {
        console.error('Error fetching reports:', error);
        setIsAuthenticated(false);
      }
    };

    fetchReports();
  }, [setAuth, navigate]);

  // Fetch the storage path of a file and open it in a new tab
  const handleView = async (file_id) => {
    try {
      const response = await fetch(`http://localhost:3000/file-path/${file_id}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        alert("Failed to retrieve file path");
        return;
      }

      const data = await response.json();
      const storagePath = data.storage_path;

      // Open the file in a new tab
      window.open(storagePath, '_blank');
    } catch (err) {
      console.error("Error fetching file path:", err.message);
      alert("Error fetching file path");
    }
  };

  // Handle report moderation (Resolve or Reject)
  const handleModerateReport = async (report_id, action) => {
    try {
      const res = await fetch('http://localhost:3000/moderate-report', {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "jwt_token": localStorage.getItem('token'),
        },
        body: JSON.stringify({
          report_id,
          action,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Report has been ${action} successfully!`);
        window.location.reload(); // Reload the page after moderation
      } else {
        alert(data.msg || "Failed to moderate report");
      }
    } catch (err) {
      console.error("Error moderating report:", err.message);
      alert("Error moderating report");
    }
  };

  // Toggle the display of moderation buttons for a specific report
  const toggleModerationButtons = (report_id) => {
    setShowModerationButtons((prev) => (prev === report_id ? null : report_id));
  };

  return (
    <div className="documents-page">
      <header className="header">
        <Link to="/"><h1 className="logo">Share2Teach</h1></Link>

        <nav className="nav">
          {userRole && ['moderator', 'admin'].includes(userRole)}
        </nav>
      </header>

      <table className="documents-table">
        <thead>
          <tr>
            <th>Report ID</th>
            <th>File ID</th>
            <th>Reason</th>
            <th>Reporter</th>
            <th>Status</th>
            <th>Reported At</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {reports.length > 0 ? (
            reports.map((report) => (
              <tr key={report.report_id}>
                <td>{report.report_id}</td>
                <td>{report.file_id}</td>
                <td>{report.reason}</td>
                <td>{report.reporter_fname} {report.reporter_lname}</td>
                <td>{report.status}</td>
                <td>{new Date(report.created_at).toLocaleString()}</td>
                <td>
                  <div className="action-container">
                    <button className="view-button" onClick={() => handleView(report.file_id)}>View File</button>
                    <span className="three-dots" onClick={() => toggleModerationButtons(report.report_id)}>&#x22EE;</span>
                    {showModerationButtons === report.report_id && (
                      <>
                        <button
                          className="approve-button"
                          style={{ backgroundColor: 'green', color: 'white' }}  // Resolve button style
                          onClick={() => handleModerateReport(report.report_id, 'resolved')}
                        >
                          Resolve
                        </button>
                        <button
                          className="reject-button"
                          style={{ backgroundColor: 'red', color: 'white' }}  // Reject button style
                          onClick={() => handleModerateReport(report.report_id, 'rejected')}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="no-reports">No pending reports</td>
            </tr>
          )}
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

      <footer className="footer">
        <p className="copyright">Copyright 2024 Share2Teach</p>
      </footer>
    </div>
  );
};

export default Reports;
