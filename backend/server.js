const express = require("express");
const app = express();
app.use(express.json());
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { Pool } = require("pg");

// Database connection
const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: process.env.DB_PASSWORD, // Use environment variable for sensitive data
  port: 5432,
  database: "teach" //change this depending of the name of your database
});

// Middleware to validate input
function validInfo(req, res, next) {
  console.log("req.body:", req.body); // Log the incoming request body for debugging
  const { email, password } = req.body;

  // Function to check if the email format is valid
  function validEmail(userEmail) {
    return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(userEmail);
  }

  // Validation for registration route
  if (req.path === "/register") {
    const { Fname, Lname } = req.body;
    // Check if all required fields are provided
    if (![email, Fname, Lname, password].every(Boolean)) {
      return res.status(400).json({ msg: "incomplete registration details" });
    // Check if the provided email is valid
    } else if (!validEmail(email)) {
      return res.status(400).json({ msg: "Invalid Email" });
    }
  // Validation for login route
  } else if (req.path === "/login") {
    // Check if both email and password are provided
    if (![email, password].every(Boolean)) {
      return res.status(400).json({ msg: "incomplete login details" });
    // Check if the provided email is valid
    } else if (!validEmail(email)) {
      return res.status(400).json({ msg: "Invalid Email" });
    }
  }
  
  next(); // Proceed to the next middleware or route handler
}

// JWT (JSON Web Token) generation function
function jwtGenerator(user_id) {
  const payload = {
    user: {
      id: user_id // Store the user's ID in the token payload
    }
  };
  // Sign and return the token with an expiration time of 1 hour
  return jwt.sign(payload, process.env.jwtSecret, { expiresIn: "1h" });
}

// Authorization middleware to protect routes
function authorize(req, res, next) {
  const token = req.header("jwt_token"); // Get the token from the request headers
  if (!token) {
    return res.status(403).json({ msg: "Authorization denied" }); // Deny access if no token is provided
  }

  try {
    const verify = jwt.verify(token, process.env.jwtSecret); // Verify the token
    req.user = verify.user; // Attach the user info from the token to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid" }); // Respond with an error if the token is invalid
  }
}

// Routes

// Root route to check if the server is running
app.get("/", (req, res) => {
  res.send("Server is now running");
});

// Registration route
app.post("/register", validInfo, async (req, res) => {
  const { email, Fname, Lname, password } = req.body;

  try {
    // Check if the user already exists in the database
    const user = await pool.query("SELECT * FROM users WHERE user_email = $1", [email]);

    if (user.rows.length > 0) {
      return res.status(401).json({ msg: "User already available" }); // Respond if the user already exists
    }

    const salt = await bcrypt.genSalt(10); // Generate a salt for password hashing
    const bcryptPassword = await bcrypt.hash(password, salt); // Hash the user's password

    // Insert the new user into the database
    let newUser = await pool.query(
      "INSERT INTO users (user_Fname, user_Lname, user_email, userpassword) VALUES ($1, $2, $3, $4) RETURNING *",
      [Fname, Lname, email, bcryptPassword]
    );

    const jwtToken = jwtGenerator(newUser.rows[0].user_id); // Generate a JWT token for the new user
    return res.json({ jwtToken }); // Respond with the token
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error"); // Respond with a server error message if something goes wrong
  }
});

// Login route
app.post("/login", validInfo, async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists in the database
    const user = await pool.query("SELECT * FROM users WHERE user_email = $1", [email]);

    if (user.rows.length === 0) {
      return res.status(401).json({ msg: "Invalid Credentials" }); // Respond if the user is not found
    }

    // Compare the provided password with the stored hashed password
    const validPassword = await bcrypt.compare(password, user.rows[0].userpassword);

    if (!validPassword) {
      return res.status(401).json({ msg: "Invalid Credentials" }); // Respond if the password is incorrect
    }

    const jwtToken = jwtGenerator(user.rows[0].user_id); // Generate a JWT token for the user
    return res.json({ jwtToken }); // Respond with the token
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error"); // Respond with a server error message if something goes wrong
  }
});

// Dashboard route (to fetch user information)
app.post("/dashboard", authorize, async (req, res) => {
  try {
    // Retrieve the user's first and last name from the database using the ID from the token
    const user = await pool.query("SELECT user_Fname, user_Lname FROM users WHERE user_id = $1", [req.user.id]);
    res.json(user.rows[0]); // Respond with the user's name
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error"); // Respond with a server error message if something goes wrong
  }
});

// Start server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
