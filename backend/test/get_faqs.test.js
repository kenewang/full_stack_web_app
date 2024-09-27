// test/faqs.test.js
const request = require('supertest');
const app = require('../server'); // Adjust the path to your Express app
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

jest.mock('pg'); // Mock the pg module
jest.mock('jsonwebtoken'); // Mock the jwt module

describe('GET /faqs', () => {
  let mockQuery;

  beforeEach(() => {
    mockQuery = jest.fn();
    Pool.prototype.query = mockQuery;
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear mocks after each test
  });

  it('should return FAQs and log page visit for logged-in user', async () => {
    const token = 'validToken';
    const decodedToken = { user: { id: 1 } }; // Mock a decoded token with user_id = 1

    // Mock the JWT token verification
    jwt.verify.mockReturnValue(decodedToken);

    // Mock the database query for retrieving FAQs
    mockQuery.mockResolvedValueOnce({
      rows: [
        { faq_id: 1, question: 'What is this?', answer: 'It is a test FAQ.' }
      ]
    });

    // Mock the database query for logging the page visit
    mockQuery.mockResolvedValueOnce({});

    const response = await request(app)
      .get('/faqs')
      .set('jwt_token', token); // Send valid JWT token in request headers

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { faq_id: 1, question: 'What is this?', answer: 'It is a test FAQ.' }
    ]);

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM public."FAQ" ORDER BY created_at DESC'
    );

    expect(jwt.verify).toHaveBeenCalledWith(token, process.env.jwtSecret);
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT INTO public."PAGE_LOGS" (user_id, page_name, action) VALUES ($1, $2, $3)',
      [1, 'FAQs Page', null]
    );
  });

  it('should return FAQs and log page visit for anonymous user', async () => {
    // Mock the database query for retrieving FAQs
    mockQuery.mockResolvedValueOnce({
      rows: [
        { faq_id: 1, question: 'What is this?', answer: 'It is a test FAQ.' }
      ]
    });

    // Mock the database query for logging the page visit
    mockQuery.mockResolvedValueOnce({});

    const response = await request(app)
      .get('/faqs');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { faq_id: 1, question: 'What is this?', answer: 'It is a test FAQ.' }
    ]);

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM public."FAQ" ORDER BY created_at DESC'
    );

    // Verify that the page visit is logged without a user_id
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT INTO public."PAGE_LOGS" (user_id, page_name, action) VALUES ($1, $2, $3)',
      [null, 'FAQs Page', null]
    );
  });

  it('should return 500 if there is a server error', async () => {
    // Mock a server error on database query
    mockQuery.mockRejectedValueOnce(new Error('Server error'));

    const response = await request(app)
      .get('/faqs');

    expect(response.status).toBe(500);
    expect(response.text).toBe('Server error');

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM public."FAQ" ORDER BY created_at DESC'
    );
  });
});
