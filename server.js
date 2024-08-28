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
  database: "share2teach"
});

// Middleware to validate input
function validInfo(req, res, next) {
  console.log("req.body:", req.body);
  const { email, password } = req.body;

  function validEmail(userEmail) {
    return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(userEmail);
  }

  if (req.path === "/register") {
    const { Fname, Lname } = req.body;
    if (![email, Fname, Lname, password].every(Boolean)) {
      return res.status(400).json({ msg: "incomplete registration details" });
    } else if (!validEmail(email)) {
      return res.status(400).json({ msg: "Invalid Email" });
    }
  } else if (req.path === "/login") {
    if (![email, password].every(Boolean)) {
      return res.status(400).json({ msg: "incomplete login details" });
    } else if (!validEmail(email)) {
      return res.status(400).json({ msg: "Invalid Email" });
    }
  }
  
  next();
}

// JWT generation function
function jwtGenerator(user_id) {
  const payload = {
    user: {
      id: user_id
    }
  };
  return jwt.sign(payload, process.env.jwtSecret, { expiresIn: "1h" });
}

// Authorization middleware
function authorize(req, res, next) {
  const token = req.header("jwt_token");
  if (!token) {
    return res.status(403).json({ msg: "Authorization denied" });
  }

  try {
    const verify = jwt.verify(token, process.env.jwtSecret);
    req.user = verify.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid" });
  }
}

// Routes

// Registration route
app.post("/register", validInfo, async (req, res) => {
  const { email, Fname, Lname, password } = req.body;

  try {
    const user = await pool.query("SELECT * FROM users WHERE user_email = $1", [email]);

    if (user.rows.length > 0) {
      return res.status(401).json({ msg: "User already available" });
    }

    const salt = await bcrypt.genSalt(10);
    const bcryptPassword = await bcrypt.hash(password, salt);

    let newUser = await pool.query(
      "INSERT INTO users (user_Fname, user_Lname, user_email, userpassword) VALUES ($1, $2, $3, $4) RETURNING *",
      [Fname, Lname, email, bcryptPassword]
    );

    const jwtToken = jwtGenerator(newUser.rows[0].user_id);
    return res.json({ jwtToken });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Login route
app.post("/login", validInfo, async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await pool.query("SELECT * FROM users WHERE user_email = $1", [email]);

    if (user.rows.length === 0) {
      return res.status(401).json({ msg: "Invalid Credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].userpassword);

    if (!validPassword) {
      return res.status(401).json({ msg: "Invalid Credentials" });
    }

    const jwtToken = jwtGenerator(user.rows[0].user_id);
    return res.json({ jwtToken });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Dashboard route (to fetch user information)
app.post("/dashboard", authorize, async (req, res) => {
  try {
    const user = await pool.query("SELECT user_Fname, user_Lname FROM users WHERE user_id = $1", [req.user.id]);
    res.json(user.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Start server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
