const request = require('supertest');
const app = require('../server'); // Adjust the path to your server.js file
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

let adminToken, moderatorToken, userToken; // Store JWT tokens

describe('Reports API Tests', () => {
  beforeAll(async () => {
    // Register and login a test admin and moderator
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
        email: 'moderatortest@example.com',
        Fname: 'Moderator',
        Lname: 'Test',
        username: 'moderatortest',
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

    const moderatorLogin = await request(app)
      .post('/login')
      .send({
        email: 'moderatortest@example.com',
        password: 'password123'
      });

    const userLogin = await request(app)
      .post('/login')
      .send({
        email: 'usertest@example.com',
        password: 'password123'
      });

    adminToken = adminLogin.body.jwtToken;
    moderatorToken = moderatorLogin.body.jwtToken;
    userToken = userLogin.body.jwtToken;

    // Assign admin and moderator roles to the registered users
    await pool.query(
      `UPDATE public."USER" SET role = 'admin' WHERE email = 'admintest@example.com'`
    );

    await pool.query(
      `UPDATE public."USER" SET role = 'moderator' WHERE email = 'moderatortest@example.com'`
    );
  });

  afterAll(async () => {
    // Cleanup test data in your tables
    await pool.query('DELETE FROM public."REPORT"');
    await pool.query('DELETE FROM public."USER" WHERE email IN ($1, $2, $3)', [
      'admintest@example.com',
      'moderatortest@example.com',
      'usertest@example.com',
    ]);
    pool.end();
  });

  // Test for admin access to reports
  it('should allow admin to view reports', async () => {
    const res = await request(app)
      .get('/reports')
      .set('jwt_token', adminToken); // Pass the JWT token

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Test for moderator access to reports
  it('should allow moderator to view reports', async () => {
    const res = await request(app)
      .get('/reports')
      .set('jwt_token', moderatorToken); // Pass the JWT token

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Test for non-admin/non-moderator access to reports
  it('should deny access for non-admin/non-moderator', async () => {
    const res = await request(app)
      .get('/reports')
      .set('jwt_token', userToken); // Pass the JWT token

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Access denied. Only admins and Moderators can view reports.');
  });

  // Test for missing token
  it('should deny access if no token is provided', async () => {
    const res = await request(app)
      .get('/reports'); // No token

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Authorization denied');
  });
});
