import React, { useState } from "react";
import { useEffect } from 'react'; // Import useEffect
import { useParams } from "react-router-dom"; // Import useParams to get the token
import axios from "axios"; // Make sure axios is installed
import './ResetPassword.css'; // Import the CSS file

const ResetPassword = () => {
  const { token } = useParams(); // Get the reset token from the URL
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.title = "Share2Teach"; // Set the tab name to "Share2Teach"
  }, []); // This ensures the title is set when the component mounts

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Send a POST request to your backend with the new password, confirmPassword, and token
      const response = await axios.post(`http://localhost:3000/reset-password/${token}`, {
        password,
        confirmPassword
      });

      setMessage(response.data.msg);
    } catch (error) {
      console.error("Error during password reset:", error);
      setMessage(error.response?.data?.msg || "An error occurred while resetting your password");
    }
  };

  return (
    <div className="reset-password-container">
      <form onSubmit={handleSubmit}>
        <h1>Reset Your Password</h1>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button type="submit">Reset Password</button>
      </form>
      {message && <p className="message">{message}</p>}
    </div>
  );
};

export default ResetPassword;
