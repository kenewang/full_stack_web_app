import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate for logout
import './FAQ.css';

const FAQ = ({ isAuthenticated, setAuth }) => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFAQs = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/faqs'); // Adjust URL if needed

         // Handle token expiration
         if (response.status === 403 || response.status === 401) {
          localStorage.removeItem("token");
          setAuth(false);
          navigate("/login");
          return;
        }


        const data = await response.json();
        setFaqs(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching FAQs:", error);
        setLoading(false);
      }
    };

    fetchFAQs();
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
        setAuth(false); // Update the authentication state
        navigate("/"); // Redirect to the landing page
      } else {
        const parseRes = await response.json();
        alert(parseRes.msg || "Logout failed");
      }
    } catch (err) {
      console.error("Error logging out:", err.message);
    }
  };

  if (loading) {
    return <div>Loading FAQs...</div>;
  }

  return (
    <div className="faq-page">
      <header className="header">
        <nav className="nav">
          {/* Show Create account and Login if NOT authenticated */}
          {!isAuthenticated ? (
            <>
              <Link to="/create-account">Create account</Link>
              <Link to="/login">Login</Link>
            </>
          ) : (
            // Show Logout if authenticated
            <div onClick={handleLogout} style={{ cursor: 'pointer' }}>Logout</div>
          )}
          <Link to="/documents">View subjects and documents</Link>
          <Link to="/contributors">Contributors</Link>
          <Link to="/about-us">About Us</Link>
        </nav>
      </header>

      <Link to="/">
        <h1 className="logo">Share2Teach</h1>
      </Link>

      <div className="faq-content">
        <h2>FAQs</h2>
        {faqs.length > 0 ? (
          faqs.map((faq) => (
            <details key={faq.faq_id} className="faq-item">
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))
        ) : (
          <p>No FAQs available</p>
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

export default FAQ;
