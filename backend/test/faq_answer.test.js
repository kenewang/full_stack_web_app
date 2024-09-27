// test/faq_answer.test.js
const request = require('supertest');
const app = require('../server'); // Adjust the path to your Express app
const { Pool } = require('pg');

jest.mock('pg'); // Mock the pg module

describe('POST /faq_answer', () => {
  let mockQuery;

  beforeEach(() => {
    mockQuery = jest.fn();
    Pool.prototype.query = mockQuery;
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear mocks after each test
  });

  it('should allow an admin to answer a FAQ', async () => {
    const token = 'validAdminToken'; // Generate or mock a valid admin token
    const faq_id = 1;
    const answer = "This is the answer to the FAQ.";

    // Mock the database query for checking user role
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });

    // Mock the database query for updating the FAQ
    mockQuery.mockResolvedValueOnce({});

    // Mock the logging action for answering an FAQ
    mockQuery.mockResolvedValueOnce({});

    const response = await request(app)
      .post('/faq_answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ faq_id, answer });

    expect(response.status).toBe(200);
    expect(response.body.msg).toBe("Answer added successfully");
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE public."FAQ" SET answer = $1 WHERE faq_id = $2',
      [answer, faq_id]
    );
  });

  it('should deny access to non-admin/non-moderator users', async () => {
    const token = 'validUserToken'; // Generate or mock a valid token for a regular user
    const faq_id = 1;
    const answer = "This is the answer to the FAQ.";

    // Mock the database query for checking user role
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'user' }] });

    const response = await request(app)
      .post('/faq_answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ faq_id, answer });

    expect(response.status).toBe(403);
    expect(response.body.msg).toBe("Permission denied");
  });

  it('should return 400 if faq_id or answer is missing', async () => {
    const token = 'validAdminToken'; // Generate or mock a valid admin token

    // Mock the database query for checking user role
    mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });

    // Case 1: Missing faq_id
    let response = await request(app)
      .post('/faq_answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ answer: "This is the answer." });

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe("Please provide both FAQ ID and answer");

    // Case 2: Missing answer
    response = await request(app)
      .post('/faq_answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ faq_id: 1 });

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe("Please provide both FAQ ID and answer");
  });

  it('should return 403 if no token is provided', async () => {
    const response = await request(app)
      .post('/faq_answer')
      .send({ faq_id: 1, answer: "This is the answer to the FAQ." });

    expect(response.status).toBe(403); // Expect a 403 Forbidden response
    expect(response.body.msg).toBe("Authorization denied");
  });
});
