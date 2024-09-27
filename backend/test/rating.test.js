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
let fileId;

describe('File Rating Tests', () => {

  beforeAll(async () => {
    // Register a test user and log in to get a valid JWT token
    await request(app)
      .post('/register')
      .send({
        email: 'ratetest@example.com',
        Fname: 'Rate',
        Lname: 'Test',
        username: 'ratetest',
        password: 'password123'
      });

    const login = await request(app)
      .post('/login')
      .send({
        email: 'ratetest@example.com',
        password: 'password123'
      });

    userToken = login.body.jwtToken;

    // Insert a test document to rate
    const fileRes = await pool.query(`
      INSERT INTO public."FILE" (file_name, subject, grade, rating, status, uploaded_by)
      VALUES ('Test Document for Rating', 'Math', 5, 4, 'pending', 1)
      RETURNING file_id;
    `);

    fileId = fileRes.rows[0].file_id;
  });

  afterAll(async () => {
    // Cleanup test data in your tables
    await pool.query('DELETE FROM public."FILE" WHERE file_id = $1', [fileId]);
    await pool.query('DELETE FROM public."USER" WHERE email = $1', ['ratetest@example.com']);
    pool.end();
  });

  // Test for rating a file by an authenticated user
  it('should allow authenticated user to rate a file', async () => {
    const res = await request(app)
      .post('/rate-file')
      .set('jwt_token', userToken)
      .send({
        file_id: fileId,
        rating: 5
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.msg).toBe('Rating submitted successfully');
    expect(res.body).toHaveProperty('averageRating');
  });

  // Test for invalid rating (out of range)
  it('should return error if rating is not between 1 and 5', async () => {
    const res = await request(app)
      .post('/rate-file')
      .set('jwt_token', userToken)
      .send({
        file_id: fileId,
        rating: 6  // Invalid rating
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.msg).toBe('Rating must be between 1 and 5');
  });

  // Test for missing file_id or rating
  it('should return error if file_id or rating is missing', async () => {
    const res = await request(app)
      .post('/rate-file')
      .set('jwt_token', userToken)
      .send({
        file_id: null, // Missing file_id
        rating: 4
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.msg).toBe('Please provide a file_id and rating');
  });

  // Test for file not found
  it('should return error if the file does not exist', async () => {
    const res = await request(app)
      .post('/rate-file')
      .set('jwt_token', userToken)
      .send({
        file_id: 9999, // Non-existing file
        rating: 5
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.msg).toBe('File not found');
  });

  // Test for open access user (anonymous user) rating a file
  it('should allow an anonymous user (open-access) to rate a file', async () => {
    const res = await request(app)
      .post('/rate-file')
      .send({
        file_id: fileId,
        rating: 4
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.msg).toBe('Rating submitted successfully');
    expect(res.body).toHaveProperty('averageRating');
  });

  // Test for invalid JWT token
  it('should return error for invalid JWT token', async () => {
    const res = await request(app)
      .post('/rate-file')
      .set('jwt_token', 'invalidToken')  // Invalid token
      .send({
        file_id: fileId,
        rating: 3
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.msg).toBe('Token is not valid');
  });
});
