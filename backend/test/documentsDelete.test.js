const request = require('supertest');
const app = require('../server');  // Adjust path to your server.js file
const { Pool } = require('pg');

// Mock the pool for database queries
const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: process.env.DB_PASSWORD,  // Use environment variable for sensitive data
  port: 5432,
  database: "share2teach_db"          // Change this depending on your database
});

let adminToken, openAccessToken; // Store JWT tokens for admin and open-access users

describe('Delete Document Route Tests', () => {

  beforeAll(async () => {
    // Register an admin user and login to get a valid JWT token
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

    adminToken = adminLogin.body.jwtToken; // Store the admin token

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

  // Test for successful document deletion by an authorized user
  it('should delete the document successfully for admin user', async () => {
    // First, create a document as an admin user (or assume it exists)
    const createdDoc = await pool.query(
      `INSERT INTO public."FILE" (file_name, subject, grade, rating, storage_path, uploaded_by)
       VALUES ('Test Document', 'Math', 5, 0, 'path/to/file', 1) RETURNING file_id`
    );
    const documentId = createdDoc.rows[0].file_id;

    const res = await request(app)
      .delete(`/documents/${documentId}`)
      .set('Authorization', `Bearer ${adminToken}`);  // Send the admin token

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Document deleted successfully');

    // Check that the document no longer exists in the database
    const checkDoc = await pool.query(`SELECT * FROM public."FILE" WHERE file_id = $1`, [documentId]);
    expect(checkDoc.rows.length).toBe(0);
  });

  // Test for access denied for unauthorized user
  it('should deny access for open-access user', async () => {
    const res = await request(app)
      .delete(`/documents/1`)
      .set('Authorization', `Bearer ${openAccessToken}`);  // Send the open-access token

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Access denied.');
  });

  // Test for document not found
  it('should return 404 if document does not exist', async () => {
    const res = await request(app)
      .delete(`/documents/999999`)  // Assume document with ID 999999 doesn't exist
      .set('Authorization', `Bearer ${adminToken}`);  // Send the admin token

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Document not found');
  });

  // Test for server errors or invalid input
  it('should return 500 for server error', async () => {
    // Simulate a server error by sending an invalid document ID
    const res = await request(app)
      .delete(`/documents/invalid-id`)  // Invalid ID (not a number)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBeDefined();  // Expect some kind of error message
  });
});
