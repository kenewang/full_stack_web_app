// src/components/About.js
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import "./About.css";

const About = () => {
  useEffect(() => {
    document.title = "About - Share2Teach"; // Set the tab name to "About - Share2Teach"
  }, []); // Ensures the title is set when the component mounts

  return (
    <div className="about-page">
      <header className="header">
        <Link to="/">
          <h1 className="logo">Share2Teach</h1>{" "}
          {/* Single link to Landing Page */}
        </Link>
      </header>

      <div className="about-content">
        <h2>About Share2Teach</h2>
        <p>
          Share2Teach is a global open educational resource (OER) platform
          developed to promote accessible, collaborative, and freely available
          educational materials. Initiated by Dr. Chantelle Bosch and Prof.
          Dorothy Laubscher at the North-West University, Share2Teach aims to
          create a community where educators and learners can share valuable
          educational resources, from comprehensive semester plans to
          project-based learning strategies.
        </p>
        <p>
          The platform is built to encourage self-directed learning and
          cooperative teaching methods, inviting participants worldwide to
          contribute and explore diverse educational content. Share2Teach offers
          users a vast array of documents across different subjects and grades,
          helping educators and learners enhance their learning experiences.
        </p>
        <p>
          By contributing to Share2Teach, you're joining a community-driven
          effort to make education more accessible, collaborative, and dynamic.
        </p>
      </div>

      <footer className="footer">
        {/* "Contact Us" button opens the email client */}
        <a href="mailto:share2teach@gmail.com">
          <button className="contact-us">Contact Us</button>
        </a>
        <p className="copyright">Copyright 2025 Share2Teach</p>
      </footer>
    </div>
  );
};

export default About;
