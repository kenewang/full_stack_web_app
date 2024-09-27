const request = require('supertest');
const app = require('../server');  // Adjust path to your server.js file
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Mock the pool for database queries
const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: process.env.DB_PASSWORD,  // Use environment variable for sensitive data
  port: 5432,
  database: "share2teach_db"          // Change this depending on your database
});

let token; // Store JWT token for logged-in user

describe('Documents Route Tests', () => {

  // Set up: Login as a user to get a token
  beforeAll(async () => {
    // Register and login a test user to get a valid JWT token
    await request(app)
      .post('/register')
      .send({
        email: 'testuser@example.com',
        Fname: 'Test',
        Lname: 'User',
        username: 'testuser',
        password: 'password123'
      });

    const res = await request(app)
      .post('/login')
      .send({
        email: 'testuser@example.com',
        password: 'password123'
      });

    token = res.body.jwtToken;  // Store the token for authenticated requests
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query(`DELETE FROM public."USER" WHERE email = 'testuser@example.com'`);
    pool.end();
  });

  // Test for anonymous user (not logged in)
  it('should return documents list for anonymous user and log the visit', async () => {
    const res = await request(app)
      .get('/documents');

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);  // Expect the response to be an array (documents list)

    // You can also mock `logPageVisit` function and verify if it was called
    // But this basic test ensures the anonymous user access works
  });

  // Test for logged-in user
  it('should return documents list for logged-in user and log the visit', async () => {
    const res = await request(app)
      .get('/documents')
      .set('Authorization', `Bearer ${token}`);  // Send the JWT token in the header

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);  // Expect the response to be an array (documents list)

    // You can also mock `logPageVisit` function to check if it logs the visit correctly
  });
});
