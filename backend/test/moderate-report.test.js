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

describe('Moderate Report API Tests', () => {
  beforeAll(async () => {
    // Register and login a test admin, moderator, and user
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

    // Insert a sample report for testing
    await pool.query(
      `INSERT INTO public."REPORT" (file_id, reason, status)
       VALUES ($1, $2, $3)`,
      [1, 'Test report reason', 'pending']
    );
  });

  afterAll(async () => {
    // Cleanup test data in your tables
    await pool.query('DELETE FROM public."REPORT" WHERE reason = $1', ['Test report reason']);
    await pool.query('DELETE FROM public."USER" WHERE email IN ($1, $2, $3)', [
      'admintest@example.com',
      'moderatortest@example.com',
      'usertest@example.com',
    ]);
    pool.end();
  });

  // Test for valid report moderation by admin
  it('should allow admin to moderate a report', async () => {
    const res = await request(app)
      .post('/moderate-report')
      .set('jwt_token', adminToken)
      .send({
        report_id: 1,
        action: 'resolved'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.msg).toBe('Report has been resolved.');
    expect(res.body.report.status).toBe('resolved');
  });

  // Test for valid report moderation by moderator
  it('should allow moderator to moderate a report', async () => {
    const res = await request(app)
      .post('/moderate-report')
      .set('jwt_token', moderatorToken)
      .send({
        report_id: 1,
        action: 'rejected'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.msg).toBe('Report has been rejected.');
    expect(res.body.report.status).toBe('rejected');
  });

  // Test for invalid action
  it('should return an error for an invalid action', async () => {
    const res = await request(app)
      .post('/moderate-report')
      .set('jwt_token', adminToken)
      .send({
        report_id: 1,
        action: 'invalid_action'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.msg).toBe("Invalid action. Use 'resolved' or 'rejected'.");
  });

  // Test for non-admin/non-moderator access
  it('should deny access for non-admin/non-moderator', async () => {
    const res = await request(app)
      .post('/moderate-report')
      .set('jwt_token', userToken)
      .send({
        report_id: 1,
        action: 'resolved'
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Access denied. Only admins and Moderators can view reports.');
  });

  // Test for missing report
  it('should return an error for a non-existent report', async () => {
    const res = await request(app)
      .post('/moderate-report')
      .set('jwt_token', adminToken)
      .send({
        report_id: 9999,  // Non-existent report_id
        action: 'resolved'
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.msg).toBe('Report not found.');
  });
});
