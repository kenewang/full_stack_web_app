import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // Importing the necessary hooks for navigation
import './RateDocument.css'; // Add custom CSS for styling

const RateDocument = () => {
  const [rating, setRating] = useState(0); // State to store the rating
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { file_id } = useParams(); // Get the document file ID from the URL params
  const navigate = useNavigate(); // Hook to navigate after submission

  // Handler for submitting the rating
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate that a rating was selected
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/rate-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`, // Include JWT if logged in
        },
        body: JSON.stringify({ file_id, rating }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.msg || 'Error submitting the rating');
      } else {
        setSuccess('Rating submitted successfully!');
        setTimeout(() => navigate('/documents'), 2000); // Redirect after 2 seconds
      }
    } catch (error) {
      setError('Error submitting the rating');
    }
  };

  return (
    <div className="rate-document-page">
      <h1>Rate Document</h1>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
      
      <form onSubmit={handleSubmit}>
        <label htmlFor="rating">Select a Rating:</label>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              type="button"
              key={star}
              className={rating >= star ? 'selected' : ''}
              onClick={() => setRating(star)}
            >
              ★
            </button>
          ))}
        </div>
        
        <button type="submit" className="submit-button">Submit Rating</button>
      </form>
    </div>
  );
};

export default RateDocument;
