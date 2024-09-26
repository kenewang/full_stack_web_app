const request = require('supertest');
const app = require('../server');  // Adjust path to your server.js
const { Pool } = require('pg');

// Set up the database connection
const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: process.env.DB_PASSWORD,
  port: 5432,
  database: "share2teach_db" // Change this depending on your database
});




// Admin Role Assignment Tests
describe('Admin Role Assignment Tests', () => {

    let adminToken;  // Store the admin token for use in requests
  
    beforeAll(async () => {
      // Create an admin user in the database
      await request(app)
        .post('/register')
        .send({
          email: 'admintest@example.com',
          Fname: 'Admin',
          Lname: 'Test',
          username: 'admintest',
          password: 'password123'
        });
  
      // Login as the admin user to get the token
      const res = await request(app)
        .post('/login')
        .send({
          email: 'admintest@example.com',
          password: 'password123'
        });
  
      adminToken = res.body.jwtToken;  // Save the admin token
    });
  
    afterAll(async () => {
      // Cleanup: Delete test users from the database
      await pool.query(`DELETE FROM public."USER" WHERE email IN ('admintest@example.com', 'opentest@example.com')`);
    });
  
    it('should allow admin to assign a new role to a user', async () => {
      // First, create a new user with a non-admin role
      await request(app)
        .post('/register')
        .send({
          email: 'opentest@example.com',
          Fname: 'Open',
          Lname: 'Test',
          username: 'opentest',
          password: 'password123'
        });
  
      // Now, assign the 'moderator' role to the user using the admin token
      const res = await request(app)
        .put('/admin/assign-role')
        .set('jwt_token', adminToken)  // Use the admin token
        .send({
          user_id: 21,  // Adjust this to the user ID of 'opentest' or fetch it dynamically
          role: 'moderator'
        });
  
      expect(res.statusCode).toBe(200);
      expect(res.body.msg).toBe('User role updated to moderator');
      expect(res.body.user.role).toBe('moderator');
    });
  });
  