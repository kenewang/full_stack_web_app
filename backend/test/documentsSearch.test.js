const request = require('supertest');
const app = require('../server');  // Adjust the path to your server.js
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Mock the pool for database queries
const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: process.env.DB_PASSWORD,  // Use environment variable for sensitive data
  port: 5432,
  database: "share2teach_db"          // Change this depending on your database
});

let token; // Store JWT token after login

describe('Document Search Route Tests', () => {

  beforeAll(async () => {
    // Register a user and log in to get a valid JWT token
    await request(app)
      .post('/register')
      .send({
        email: 'searchtest@example.com',
        Fname: 'Search',
        Lname: 'Test',
        username: 'searchtest',
        password: 'password123'
      });

    const login = await request(app)
      .post('/login')
      .send({
        email: 'searchtest@example.com',
        password: 'password123'
      });

    token = login.body.jwtToken; // Store the token for authenticated requests

    // Insert some test documents for searching
    await pool.query(`
      INSERT INTO public."FILE" (file_name, subject, grade, rating, status, uploaded_by)
      VALUES
      ('Test Document 1', 'Math', 5, 4, 'approved', 1),
      ('Test Document 2', 'Science', 7, 5, 'pending', 1),
      ('Test Document 3', 'Math', 6, 3, 'approved', 1)
    `);

    // Insert keywords related to these documents
    await pool.query(`
      INSERT INTO public."KEYWORD" (keyword) VALUES ('algebra'), ('biology'), ('geometry');
    `);
    
    // Link keywords to the documents
    const doc1 = await pool.query('SELECT file_id FROM public."FILE" WHERE file_name = $1', ['Test Document 1']);
    const doc2 = await pool.query('SELECT file_id FROM public."FILE" WHERE file_name = $1', ['Test Document 2']);
    await pool.query('INSERT INTO public."FILE_KEYWORD" (file_id, keyword_id) VALUES ($1, 1)', [doc1.rows[0].file_id]);
    await pool.query('INSERT INTO public."FILE_KEYWORD" (file_id, keyword_id) VALUES ($1, 2)', [doc2.rows[0].file_id]);
  });

  afterAll(async () => {
    // Cleanup test data in your tables
    await pool.query('DELETE FROM public."FILE" WHERE file_name IN ($1, $2, $3)', ['Test Document 1', 'Test Document 2', 'Test Document 3']);
    await pool.query('DELETE FROM public."KEYWORD" WHERE keyword IN ($1, $2)', ['algebra', 'biology']);
    await pool.query('DELETE FROM public."USER" WHERE email = $1', ['searchtest@example.com']);
    pool.end();
  });

  // Test without filters
  it('should return all documents when no filters are applied', async () => {
    const res = await request(app)
      .get('/search-documents')
      .set('Authorization', `Bearer ${token}`);  // Send token for authenticated user

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);  // There should be at least 3 documents
  });

  // Test with filters (e.g., filter by subject)
  it('should filter documents by subject', async () => {
    const res = await request(app)
      .get('/search-documents?subject=Math')  // Filter by subject
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(2);  // 2 documents with subject "Math"
    expect(res.body[0].subject).toBe('Math');
  });

  // Test with multiple filters
  it('should filter documents by grade and status', async () => {
    const res = await request(app)
      .get('/search-documents?grade=5&status=approved')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);  // Only 1 document with grade 5 and status "approved"
    expect(res.body[0].file_name).toBe('Test Document 1');
  });

  // Test for keyword search
  it('should filter documents by keyword', async () => {
    const res = await request(app)
      .get('/search-documents?keywords=algebra')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);  // Only 1 document with keyword "algebra"
    expect(res.body[0].file_name).toBe('Test Document 1');
  });

  // Test for anonymous users (no token provided)
  it('should work for anonymous users (no token)', async () => {
    const res = await request(app)
      .get('/search-documents');  // No token provided

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);  // Should return documents
  });

  // Test for logging page visit with JWT
  it('should log the search for logged-in users', async () => {
    const res = await request(app)
      .get('/search-documents?file_name=Test')
      .set('Authorization', `Bearer ${token}`);  // Send token for authenticated user

    expect(res.statusCode).toBe(200);
    // Ensure the response includes the expected documents
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});
