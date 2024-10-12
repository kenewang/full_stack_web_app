// src/components/FAQ.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';  // Import Link from react-router-dom

import './FAQ.css';

const FAQ = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFAQs = async () => {
      try {
        const response = await fetch('http://localhost:3000/faqs'); // Adjust URL if needed
        const data = await response.json();
        setFaqs(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching FAQs:", error);
        setLoading(false);
      }
    };

    fetchFAQs();
  }, []);

  if (loading) {
    return <div>Loading FAQs...</div>;
  }

  return (
    <div className="faq-page">
      <header className="header">
        <nav className="nav">
        <Link to="/create-account">Create account</Link>
        <Link to="/login">Login</Link>
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
