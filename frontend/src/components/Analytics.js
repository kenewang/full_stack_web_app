import React, { useState, useEffect } from 'react';
import './Analytics.css'; // Ensure your CSS file is correctly imported

function Analytics() {
  const [analyticsData, setAnalyticsData] = useState([]);
  const [activityLogsData, setActivityLogsData] = useState([]);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    fetchActivityLogs();
  }, []);

  document.title = "Share2Teach"; // Set the tab name to "Share2Teach"

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/analytics', {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          "jwt_token": token || ''
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setAnalyticsData(data);
      } else {
        console.error('Unexpected data structure for analytics:', data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/activity-logs', {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          "jwt_token": token || ''
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setActivityLogsData(data);
      } else {
        console.error('Unexpected data structure for activity logs:', data);
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };

  const openAnalyticsModal = () => {
    setShowAnalyticsModal(true);
    document.body.style.overflow = 'hidden'; // Disable scrolling when modal is open
  };

  const openActivityLogModal = () => {
    setShowActivityLogModal(true);
    document.body.style.overflow = 'hidden'; // Disable scrolling when modal is open
  };

  const closeAnalyticsModal = () => {
    setShowAnalyticsModal(false);
    document.body.style.overflow = 'auto'; // Re-enable scrolling when modal is closed
  };

  const closeActivityLogModal = () => {
    setShowActivityLogModal(false);
    document.body.style.overflow = 'auto'; // Re-enable scrolling when modal is closed
  };

  return (
    <div className="analytics-container">
      <h1>Analytics</h1>
      <div className="button-container">
        <button onClick={openAnalyticsModal}>View Analytics</button>
        <button onClick={openActivityLogModal}>View Activity Logs</button>
      </div>

      {/* Modal for Analytics */}
      {showAnalyticsModal && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={closeAnalyticsModal}>&times;</span>
            <h2>Analytics Data</h2>
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Page Visited</th>
                  <th>Time Spent</th>
                  <th>Visit Date</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.map(item => (
                  <tr key={item.analytics_id}>
                    <td>{item.user_id}</td>
                    <td>{item.page_visited}</td>
                    <td>{item.time_spent}</td>
                    <td>{new Date(item.visit_date).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Activity Logs */}
      {showActivityLogModal && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={closeActivityLogModal}>&times;</span>
            <h2>Activity Log Data</h2>
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Activity Type</th>
                  <th>Description</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {activityLogsData.map(item => (
                  <tr key={item.log_id}>
                    <td>{item.user_id}</td>
                    <td>{item.activity_type}</td>
                    <td>{item.description}</td>
                    <td>{new Date(item.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;
