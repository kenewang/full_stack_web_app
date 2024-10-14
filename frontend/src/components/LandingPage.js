// src/components/LandingPage.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = ({ isAuthenticated, setAuth }) => {
  const navigate = useNavigate();

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
          <Link to="/contributors">Contributors</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/about-us">About Us</Link>
        </nav>
      </header>
      
      <footer className="footer">
        <button className="contact-us">Contact Us</button>
        <div className="social-media-icons">Social Media Icons</div>
        <p className="copyright">Copyright 2024 Share2Teach</p>
      </footer>
    </div>
  );
};

export default LandingPage;
