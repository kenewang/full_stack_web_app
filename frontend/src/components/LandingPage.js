// src/components/LandingPage.js
import React from 'react';
import { useEffect } from 'react'; // Import useEffect
import { Link, useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = ({ isAuthenticated, setAuth }) => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Share2Teach"; // Set the tab name to "Share2Teach"
  }, []); // This ensures the title is set when the component mounts

  const handleLogout = async () => {
    try {
      const response = await fetch("http://localhost:3000/logout", {
        method: "POST",
        headers: {
          "jwt_token": localStorage.getItem('token'), 
        },
      });

      // Handle token expiration
      if (response.status === 403 || response.status === 401) {
        localStorage.removeItem("token");
        setAuth(false);
        navigate("/login");
        return;
      }

      const parseRes = await response.json();

      if (response.ok) {
        localStorage.removeItem("token");
        setAuth(false);
        navigate("/");
      } else {
        alert(parseRes.msg || "Logout failed");
      }
    } catch (err) {
      console.error("Error logging out:", err.message);
    }
  };

  return (
    <div className="landing-page">
      <header className="header">
        <h1 className="logo">Share2Teach</h1>
        
        <nav className="nav">
          {!isAuthenticated ? (
            <>
              <Link to="/register">Create account</Link>
              <Link to="/login">Login</Link>
            </>
          ) : (
            <div onClick={handleLogout} style={{ cursor: 'pointer' }}>Logout</div>
          )}
          <Link to="/documents">View subjects and documents</Link>
          
          <Link to="/faq">FAQ</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      
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

export default LandingPage;
