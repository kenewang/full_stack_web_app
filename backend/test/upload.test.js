const request = require('supertest');
const path = require('path');
const app = require('../server');  // Adjust the path to your server.js file
const { Pool } = require('pg');

// Mock the pool for database queries
const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: process.env.DB_PASSWORD,  // Use environment variable for sensitive data
  port: 5432,
  database: "share2teach_db"          // Change this depending on your database
});

let adminToken, userToken;

describe('Document Upload Tests', () => {
  beforeAll(async () => {
    // Register and login test users (admin and regular user)
    await request(app)
      .post('/register')
      .send({
        email: 'admintest@example.com',
        Fname: 'Admin',
        Lname: 'Test',
        username: 'admintest',
        password: 'password123'
      });

    await request(app)
      .post('/register')
      .send({
        email: 'usertest@example.com',
        Fname: 'User',
        Lname: 'Test',
        username: 'usertest',
        password: 'password123'
      });

    const adminLogin = await request(app)
      .post('/login')
      .send({
        email: 'admintest@example.com',
        password: 'password123'
      });

    const userLogin = await request(app)
      .post('/login')
      .send({
        email: 'usertest@example.com',
        password: 'password123'
      });

    adminToken = adminLogin.body.jwtToken;
    userToken = userLogin.body.jwtToken;

    // Assign admin role to the registered admin user
    await pool.query(
      `UPDATE public."USER" SET role = 'admin' WHERE email = 'admintest@example.com'`
    );
  });

  afterAll(async () => {
    // Cleanup test data in your tables
    await pool.query('DELETE FROM public."FILE" WHERE uploaded_by = (SELECT user_id FROM public."USER" WHERE email = $1)', ['admintest@example.com']);
    await pool.query('DELETE FROM public."USER" WHERE email IN ($1, $2)', [
      'admintest@example.com',
      'usertest@example.com'
    ]);
    pool.end();
  });

  // Test for successful document upload
  it('should upload a document successfully for admin', async () => {
    const res = await request(app)
      .post('/documents')
      .set('jwt_token', adminToken)  // Pass the admin token
      .field('file_name', 'Test Document')
      .field('subject', 'Math')
      .field('grade', '1')
      .field('keywords', 'algebra, geometry')
      .attach('file', path.resolve(__dirname, 'test-files/test-file.pdf'));  // Attach a test PDF file

    expect(res.statusCode).toBe(201);
    expect(res.body.file).toHaveProperty('file_name', 'Test Document');
  });

  // Test for unauthorized role
  it('should deny access for a regular user', async () => {
    const res = await request(app)
      .post('/documents')
      .set('jwt_token', userToken)  // Pass the regular user token
      .field('file_name', 'Test Document')
      .field('subject', 'Math')
      .field('grade', '1')
      .field('keywords', 'algebra, geometry')
      .attach('file', path.resolve(__dirname, 'test-files/test-file.pdf'));

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Access denied. Only admins, moderators, and educators can upload documents.');
  });

  // Test for missing file
  it('should return error if no file is provided', async () => {
    const res = await request(app)
      .post('/documents')
      .set('jwt_token', adminToken)  // Pass the admin token
      .field('file_name', 'Test Document')
      .field('subject', 'Math')
      .field('grade', '1')
      .field('keywords', 'algebra, geometry');

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('No file selected!');
  });
});
