// test/activityLogs.test.js
const request = require('supertest');
const app = require('../server'); // Adjust the path to your Express app
const { Pool } = require('pg');

jest.mock('pg'); // Mock the pg module to prevent actual DB calls

describe('GET /activity-logs', () => {
  let mockQuery;
  let mockResponse;

  beforeEach(() => {
    mockQuery = jest.fn();
    mockResponse = { rows: [{ id: 1, action: 'User logged in', timestamp: new Date() }] }; // Mock response
    Pool.prototype.query = mockQuery.mockResolvedValue(mockResponse); // Mock the query method
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear mocks after each test
  });

  it('should return activity logs for admin users', async () => {
    const token = 'validAdminToken'; // You would typically generate a valid token here

    const response = await request(app)
      .get('/activity-logs')
      .set('Authorization', `Bearer ${token}`); // Set the authorization header

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse.rows); // Check if the response matches the mocked response
    expect(mockQuery).toHaveBeenCalledWith(`SELECT * FROM public."ACTIVITY_LOG" ORDER BY timestamp DESC`);
  });

  it('should deny access for non-admin users', async () => {
    const token = 'validModeratorToken'; // A valid token for a moderator or another role

    const response = await request(app)
      .get('/activity-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403); // Expect a 403 Forbidden response
    expect(response.body).toEqual({ msg: "Access denied. Only admins and moderators can view activity logs." });
  });

  it('should return 403 for unauthorized users', async () => {
    const response = await request(app)
      .get('/activity-logs')
      .set('Authorization', ''); // No token

    expect(response.status).toBe(403); // Expect a 403 Forbidden response
    expect(response.body).toEqual({ msg: "Authorization denied" });
  });
});
