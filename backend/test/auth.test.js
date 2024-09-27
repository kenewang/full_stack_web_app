const jwt = require('jsonwebtoken');
const { jwtGenerator } = require('../server'); // Adjust path to your server.js file

const app = require('../server');  // Adjust based on the relative location of your test file





const request = require('supertest');

const { Pool } = require('pg');
const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: process.env.DB_PASSWORD,  // Use environment variable for sensitive data
  port: 5432,
  database: "share2teach_db"          // Change this depending on your database
});

let token; // Store JWT token after login

describe('User Authentication Integration Tests', () => {

  // Clear database or reset necessary tables before/after tests
  beforeAll(async () => {
    // You can add necessary setup, like cleaning up test data in your tables
    await pool.query(`DELETE FROM public."USER" WHERE email = 'testuser@example.com'`);
  });

  afterAll(async () => {
    // Cleanup test data in your tables
    await pool.query(`DELETE FROM public."USER" WHERE email = 'testuser@example.com'`);
    pool.end();
  });

  // Integration Test for Register Endpoint
  describe('POST /register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          email: 'testuser@example.com',
          Fname: 'Test',
          Lname: 'User',
          username: 'testuser',
          password: 'password123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('jwtToken');
    });

    it('should return error if email already exists', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          email: 'testuser@example.com',
          Fname: 'Test',
          Lname: 'User',
          username: 'testuser',
          password: 'password123'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.msg).toBe('User already exists');
    });
  });

  // Integration Test for Login Endpoint
  describe('POST /login', () => {
    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/login')
        .send({
          email: 'testuser@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('jwtToken');
      token = res.body.jwtToken; // Save the token for further tests
    });

    it('should return error for invalid credentials', async () => {
      const res = await request(app)
        .post('/login')
        .send({
          email: 'testuser@example.com',
          password: 'wrongpassword'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.msg).toBe('Invalid Credentials. Incorrect password.');
    });
  });

  // Integration Test for Logout Endpoint
  describe('POST /logout', () => {
    it('should log out the user successfully', async () => {
      const res = await request(app)
        .post('/logout')
        .set('jwt_token', token);  // Pass the token in the header

      expect(res.statusCode).toBe(200);
      expect(res.body.msg).toBe('Successfully logged out. Token is now invalid.');
    });

    it('should return error if no token is provided', async () => {
      const res = await request(app)
        .post('/logout');

      expect(res.statusCode).toBe(403);
      expect(res.body.msg).toBe('Authorization denied');
    });
  });

  // Integration Test for Active User Info Endpoint
  describe('POST /active_user', () => {
    it('should return active user info with valid token', async () => {
      const res = await request(app)
        .post('/active_user')
        .set('jwt_token', token);  // Pass the token in the header

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('fname', 'Test');
      expect(res.body).toHaveProperty('lname', 'User');
    });

    it('should return error if no token is provided', async () => {
      const res = await request(app)
        .post('/active_user'); // No token provided

      expect(res.statusCode).toBe(403);
      expect(res.body.msg).toBe('Authorization denied');
    });
  });

});
