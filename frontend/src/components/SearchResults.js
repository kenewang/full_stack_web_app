import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SearchResults = () => {
  const [searchResults, setSearchResults] = useState([]);
  const location = useLocation(); // Get the current location
  const searchParams = new URLSearchParams(location.search); // Get the search parameters from URL

  useEffect(() => {
    const fetchSearchResults = async () => {
      try {
        // Build the search query dynamically
        const query = searchParams.toString();
        
        // Make an API request to your backend with the query
        const response = await fetch(`http://localhost:3000/search-documents?${query}`);
        const data = await response.json();
        setSearchResults(data); // Set the search results in state
      } catch (error) {
        console.error('Error fetching search results:', error);
      }
    };

    fetchSearchResults();
  }, [location.search]); // Re-fetch whenever the search parameters change

  return (
    <div>
      <h2>Search Results</h2>
      {searchResults.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Grade</th>
              <th>File Name</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {searchResults.map((doc) => (
              <tr key={doc.file_id}>
                <td>{doc.subject_name}</td>
                <td>{doc.grade_name}</td>
                <td>{doc.file_name}</td>
                <td>{doc.rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No results found.</p>
      )}
    </div>
  );
};

export default SearchResults;
