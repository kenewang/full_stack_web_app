import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './FileUpload.css';


const FileUpload = () => {
  const [file_name, setFileName] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [keywords, setKeywords] = useState('');
  const [file, setFile] = useState(null);
  const [subjectsList, setSubjectsList] = useState([]);
  const [gradesList, setGradesList] = useState([]);
  const navigate = useNavigate();
  const [message, setMessage] = useState('');

  // Fetch subjects and grades from API on component mount
  useEffect(() => {
    const fetchSubjectsAndGrades = async () => {
      try {
        const [subjectsRes, gradesRes] = await Promise.all([
          axios.get('http://localhost:3000/subjects'),
          axios.get('http://localhost:3000/grades')
        ]);
        setSubjectsList(subjectsRes.data);
        setGradesList(gradesRes.data);
      } catch (error) {
        console.error('Error fetching subjects/grades:', error);
      }
    };

    fetchSubjectsAndGrades();
  }, []);

  // Handle file upload form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('file_name', file_name);
    formData.append('subject', subject);
    formData.append('grade', grade);
    formData.append('keywords', keywords);
    formData.append('file', file);

    for (let pair of formData.entries()) {
        console.log(`${pair[0]}: ${pair[1]}`);
      }
    
    try {
        const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:3000/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'jwt_token': token, // Include the JWT token her
        },
      });
      setMessage('File uploaded successfully!');
      navigate('/documents'); // Redirect to DocumentsView
    } catch (error) {
      console.error('Error uploading file:', error);
      setMessage('Error uploading file!');
    }
  };

  return (
    <div className="file-upload-container">
      <h2>Upload A Document</h2>
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <div>
          <label>File Name:</label>
          <input
            type="text"
            value={file_name}
            onChange={(e) => setFileName(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Subject:</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} required>
            <option value="">Select Subject</option>
            {subjectsList.map((sub) => (
              <option key={sub.subject_id} value={sub.subject_id}>
                {sub.subject_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Grade:</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} required>
            <option value="">Select Grade</option>
            {gradesList.map((gr) => (
              <option key={gr.grade_id} value={gr.grade_id}>
                {gr.grade_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Keywords:</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Separate with commas"
            required
          />
        </div>
        <div>
          <label>File:</label>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} required />
        </div>
        <button type="submit">Submit</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default FileUpload;
