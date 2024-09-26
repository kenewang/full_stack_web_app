const request = require('supertest');
const app = require('../server');  // Adjust the path to your server.js
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

let moderatorToken; // Store JWT token after login

describe('Document Moderation Tests', () => {

  beforeAll(async () => {
    // Register a moderator user and log in to get a valid JWT token
    await request(app)
      .post('/register')
      .send({
        email: 'moderatortest@example.com',
        Fname: 'Moderator',
        Lname: 'Test',
        username: 'moderatortest',
        password: 'password123'
      });

    const login = await request(app)
      .post('/login')
      .send({
        email: 'moderatortest@example.com',
        password: 'password123'
      });

    moderatorToken = login.body.jwtToken; // Save the token for authenticated requests

    // Change the role of the user to moderator
    await pool.query(`
      UPDATE public."USER" SET role = 'moderator' WHERE email = 'moderatortest@example.com';
    `);

    // Insert a test document for moderation
    await pool.query(`
      INSERT INTO public."FILE" (file_name, subject, grade, rating, status, uploaded_by)
      VALUES ('Test Document for Moderation', 'Math', 5, 4, 'pending', 1);
    `);
  });

  afterAll(async () => {
    // Cleanup test data in your tables
    await pool.query('DELETE FROM public."FILE" WHERE file_name = $1', ['Test Document for Moderation']);
    await pool.query('DELETE FROM public."USER" WHERE email = $1', ['moderatortest@example.com']);
    pool.end();
  });

  // Test for moderation action - approve
  it('should allow moderator to approve a document', async () => {
    const document = await pool.query('SELECT file_id FROM public."FILE" WHERE file_name = $1', ['Test Document for Moderation']);

    const res = await request(app)
      .post('/moderate-document')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({
        file_id: document.rows[0].file_id,
        action: 'approved',
        comments: 'Looks good'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.msg).toBe('Document moderated successfully');
    expect(res.body.updatedFile.status).toBe('approved');
  });

  // Test for moderation action - reject
  it('should allow moderator to reject a document', async () => {
    const document = await pool.query('SELECT file_id FROM public."FILE" WHERE file_name = $1', ['Test Document for Moderation']);

    const res = await request(app)
      .post('/moderate-document')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({
        file_id: document.rows[0].file_id,
        action: 'rejected',
        comments: 'Needs more information'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.msg).toBe('Document moderated successfully');
    expect(res.body.updatedFile.status).toBe('rejected');
  });

  // Test for invalid action
  it('should return error for invalid action', async () => {
    const document = await pool.query('SELECT file_id FROM public."FILE" WHERE file_name = $1', ['Test Document for Moderation']);

    const res = await request(app)
      .post('/moderate-document')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({
        file_id: document.rows[0].file_id,
        action: 'invalid-action',
        comments: 'Invalid action test'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.msg).toBe('Invalid action');
  });

  // Test for unauthorized access
  it('should deny access if user is not a moderator or admin', async () => {
    const userLogin = await request(app)
      .post('/login')
      .send({
        email: 'opentest@example.com', // Assume this is a non-moderator user
        password: 'password123'
      });

    const document = await pool.query('SELECT file_id FROM public."FILE" WHERE file_name = $1', ['Test Document for Moderation']);

    const res = await request(app)
      .post('/moderate-document')
      .set('Authorization', `Bearer ${userLogin.body.jwtToken}`)
      .send({
        file_id: document.rows[0].file_id,
        action: 'approved',
        comments: 'Trying to approve as non-moderator'
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Failed. Only admins and moderators can moderate documents.');
  });

  // Test for file not found
  it('should return error if file is not found', async () => {
    const res = await request(app)
      .post('/moderate-document')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({
        file_id: 9999,  // Assuming this file does not exist
        action: 'approved',
        comments: 'Non-existing file moderation'
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.msg).toBe('File not found or could not update status');
  });
});
