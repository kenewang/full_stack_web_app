// test/faq.test.js
const request = require('supertest');
const app = require('../server'); // Adjust path to your Express app
const { Pool } = require('pg');

jest.mock('pg'); // Mock the pg module

describe('POST /faq', () => {
  let mockQuery;

  beforeEach(() => {
    mockQuery = jest.fn();
    Pool.prototype.query = mockQuery;
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear mocks after each test
  });

  it('should create a FAQ for an admin', async () => {
    const token = 'validAdminToken'; // Generate or mock a valid admin token
    const question = "What is Share2Teach?";

    // Mocking the database query for inserting the FAQ
    const mockFAQ = { faq_id: 1, question, created_by: 1 };
    mockQuery.mockResolvedValueOnce({ rows: [mockFAQ] });

    // Mock the logging action for creating an FAQ
    mockQuery.mockResolvedValueOnce({});

    const response = await request(app)
      .post('/faq')
      .set('Authorization', `Bearer ${token}`)
      .send({ question });

    expect(response.status).toBe(200);
    expect(response.body.msg).toBe("FAQ created successfully");
    expect(response.body.faq).toEqual(mockFAQ); // Verify that the FAQ was returned correctly
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT INTO public."FAQ" (question, created_by) VALUES ($1, $2) RETURNING *',
      [question, 1] // Assume user_id 1 for the admin
    );
  });

  it('should deny access for non-admin users', async () => {
    const token = 'validUserToken'; // A valid token for a regular user
    const question = "What is Share2Teach?";

    const response = await request(app)
      .post('/faq')
      .set('Authorization', `Bearer ${token}`)
      .send({ question });

    expect(response.status).toBe(403); // Expect a 403 Forbidden response
    expect(response.body.msg).toBe("Access denied. Only admins or moderators can create FAQs.");
  });

  it('should return 400 if the question is missing', async () => {
    const token = 'validAdminToken'; // Mock a valid admin token

    const response = await request(app)
      .post('/faq')
      .set('Authorization', `Bearer ${token}`)
      .send({}); // Send an empty body without a question

    expect(response.status).toBe(400); // Expect a 400 Bad Request response
    expect(response.body.msg).toBe("Please provide a question");
  });

  it('should return 403 if no token is provided', async () => {
    const response = await request(app)
      .post('/faq')
      .send({ question: "What is Share2Teach?" });

    expect(response.status).toBe(403); // Expect a 403 Forbidden response
    expect(response.body.msg).toBe("Authorization denied");
  });
});
