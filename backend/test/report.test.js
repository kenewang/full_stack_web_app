const request = require('supertest');
const app = require('../server');  // Adjust the path to your server.js file
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

let userToken; // Store JWT token after login
let fileId; // Store a file ID for reporting

describe('Document Reporting Tests', () => {
  beforeAll(async () => {
    // Register a test user and log in to get a valid JWT token
    await request(app)
      .post('/register')
      .send({
        email: 'reporttest@example.com',
        Fname: 'Report',
        Lname: 'Test',
        username: 'reporttest',
        password: 'password123'
      });

    const login = await request(app)
      .post('/login')
      .send({
        email: 'reporttest@example.com',
        password: 'password123'
      });

    userToken = login.body.jwtToken;

    // Insert a test document to report
    const fileRes = await pool.query(`
      INSERT INTO public."FILE" (file_name, subject, grade, rating, status, uploaded_by)
      VALUES ('Test Document for Reporting', 'Math', 5, 4, 'approved', 1)
      RETURNING file_id;
    `);

    fileId = fileRes.rows[0].file_id;
  });

  afterAll(async () => {
    // Cleanup test data in your tables
    await pool.query('DELETE FROM public."REPORT" WHERE file_id = $1', [fileId]);
    await pool.query('DELETE FROM public."FILE" WHERE file_id = $1', [fileId]);
    await pool.query('DELETE FROM public."USER" WHERE email = $1', ['reporttest@example.com']);
    pool.end();
  });

  // Test for reporting a document by an authenticated user
  it('should allow authenticated user to report a document', async () => {
    const res = await request(app)
      .post('/report-document')
      .set('jwt_token', userToken)  // Pass the JWT token
      .send({
        file_id: fileId,
        reason: 'Inappropriate content'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.msg).toBe('Report submitted successfully');
  });

  // Test for anonymous user reporting a document
  it('should allow anonymous user to report a document', async () => {
    const res = await request(app)
      .post('/report-document')
      .send({
        file_id: fileId,
        reason: 'Inappropriate content'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.msg).toBe('Report submitted successfully');
  });

  // Test for missing file_id or reason
  it('should return error if file_id or reason is missing', async () => {
    const res = await request(app)
      .post('/report-document')
      .set('jwt_token', userToken)  // Pass the JWT token
      .send({
        file_id: null,  // Missing file_id
        reason: 'Inappropriate content'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.msg).toBe('Please provide a valid file_id and reason');
  });
});
