const request = require('supertest');
const app = require('../server');  // Adjust path to your server.js file
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

let adminToken, openAccessToken; // Store JWT tokens for admin and open-access users

describe('Update Document Route Tests', () => {

  beforeAll(async () => {
    // Register an admin user to get a valid JWT token for authorized requests
    await request(app)
      .post('/register')
      .send({
        email: 'admintest@example.com',
        Fname: 'Admin',
        Lname: 'User',
        username: 'admintest',
        password: 'password123'
      });

    const adminLogin = await request(app)
      .post('/login')
      .send({
        email: 'admintest@example.com',
        password: 'password123'
      });

    adminToken = adminLogin.body.jwtToken; // Store the admin token for authenticated requests

    // Register an open-access user for unauthorized access tests
    await request(app)
      .post('/register')
      .send({
        email: 'opentest@example.com',
        Fname: 'Open',
        Lname: 'User',
        username: 'opentest',
        password: 'password123'
      });

    const openLogin = await request(app)
      .post('/login')
      .send({
        email: 'opentest@example.com',
        password: 'password123'
      });

    openAccessToken = openLogin.body.jwtToken; // Store the open-access token
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query(`DELETE FROM public."USER" WHERE email IN ('admintest@example.com', 'opentest@example.com')`);
    pool.end();
  });

  // Test for successful document update by authorized user
  it('should update the document successfully for admin user', async () => {
    // First, create a document as an admin user (or assume it exists)
    const createdDoc = await pool.query(
      `INSERT INTO public."FILE" (file_name, subject, grade, rating, storage_path, uploaded_by)
       VALUES ('Test Document', 'Math', 5, 0, 'path/to/file', 1) RETURNING file_id`
    );
    const documentId = createdDoc.rows[0].file_id;

    const res = await request(app)
      .put(`/documents/${documentId}`)
      .set('Authorization', `Bearer ${adminToken}`)  // Send the admin token in the header
      .send({
        file_name: 'Updated Test Document',
        subject: 'Science',
        grade: 6
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.file_name).toBe('Updated Test Document');
    expect(res.body.subject).toBe('Science');
    expect(res.body.grade).toBe(6);
  });

  // Test for access denied for unauthorized user
  it('should deny access for open-access user', async () => {
    const res = await request(app)
      .put(`/documents/1`)
      .set('Authorization', `Bearer ${openAccessToken}`)  // Send the open-access token
      .send({
        file_name: 'Updated Test Document',
        subject: 'Science',
        grade: 6
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Access denied.');
  });

  // Test for document not found
  it('should return 404 if document does not exist', async () => {
    const res = await request(app)
      .put(`/documents/999999`)  // Assume document with ID 999999 doesn't exist
      .set('Authorization', `Bearer ${adminToken}`)  // Send the admin token
      .send({
        file_name: 'Non-existent Document',
        subject: 'None',
        grade: 0
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Document not found');
  });

  // Test for invalid input or server errors
  it('should return 500 for invalid input or server error', async () => {
    // Simulate invalid input or server error by sending invalid values
    const res = await request(app)
      .put(`/documents/1`)
      .set('Authorization', `Bearer ${adminToken}`)  // Send the admin token
      .send({
        file_name: '',  // Empty name should trigger validation error
        subject: 'Science',
        grade: 6
      });

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBeDefined();  // Expect some kind of error message
  });
});
