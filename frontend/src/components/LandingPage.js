// src/components/LandingPage.js
import React from 'react';
import './LandingPage.css'; // Import the CSS file for styling

const LandingPage = () => {
  return (
    <div className="landing-page">
      <header className="header">
        <h1 className="logo">Share2Teach</h1>
        <nav className="nav">
          <a href="/create-account">Create account</a>
          <a href="/login">Login</a>
          <a href="/view-subjects-docs">View subjects and documents</a>
          <a href="/contributors">Contributors</a>
          <a href="/faq">FAQ</a>
          <a href="/about-us">About Us</a>
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
