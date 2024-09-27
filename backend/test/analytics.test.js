// test/analytics.test.js
const request = require('supertest');
const app = require('../server'); // Adjust the path to your Express app
const { Pool } = require('pg');

jest.mock('pg'); // Mock the pg module to prevent actual DB calls

describe('GET /analytics', () => {
  let mockQuery;
  let mockResponse;

  beforeEach(() => {
    mockQuery = jest.fn();
    mockResponse = { rows: [{ id: 1, visit_count: 100, visit_date: new Date() }] }; // Mock response
    Pool.prototype.query = mockQuery.mockResolvedValue(mockResponse); // Mock the query method
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear mocks after each test
  });

  it('should return user analytics for admin users', async () => {
    const token = 'validAdminToken'; // Generate or mock a valid admin token

    const response = await request(app)
      .get('/analytics')
      .set('Authorization', `Bearer ${token}`); // Set the authorization header

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse.rows); // Check if the response matches the mocked response
    expect(mockQuery).toHaveBeenCalledWith(`SELECT * FROM public."ANALYTICS" ORDER BY visit_date DESC`);
  });

  it('should deny access for non-admin users', async () => {
    const token = 'validUserToken'; // A valid token for a regular user or another role

    const response = await request(app)
      .get('/analytics')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403); // Expect a 403 Forbidden response
    expect(response.body).toEqual({ msg: "Access denied. Only admins and moderators can view user analytics." });
  });

  it('should return 403 for unauthorized users', async () => {
    const response = await request(app)
      .get('/analytics')
      .set('Authorization', ''); // No token

    expect(response.status).toBe(403); // Expect a 403 Forbidden response
    expect(response.body).toEqual({ msg: "Authorization denied" });
  });
});
