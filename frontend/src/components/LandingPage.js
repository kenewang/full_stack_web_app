// src/components/LandingPage.js
import React from 'react';
import { Link } from 'react-router-dom';  // Import Link from react-router-dom
import './LandingPage.css';  // Import the CSS file for styling

const LandingPage = () => {
  return (
    <div className="landing-page">
      <header className="header">
      <h1 className="logo">Share2Teach</h1>
        
        <nav className="nav">
          <Link to="/create-account">Create account</Link>
          <Link to="/login">Login</Link>
          <Link to="/view-subjects-docs">View subjects and documents</Link>
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
