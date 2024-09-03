const express = require("express");
const app = express(); //Initialize Express app
app.use(express.json());
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { Pool } = require("pg");

const multer = require('multer');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const util = require('util');

// Database connection
const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: process.env.DB_PASSWORD, // Use environment variable for sensitive data
  port: 5432,
  database: "share2teach_db" //change this depending of the name of your database
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


// ------------Develop basic CRUD operations for documents.[Kenewang]-------------

// Create a new document
 
// Create a new document
app.post('/documents', async (req, res) => {
  const { file_name, subject, grade, rating, storage_path, uploaded_by } = req.body; // Set default rating

  try {
      const result = await pool.query(
          `INSERT INTO public."FILE" (file_name, subject, grade, rating, storage_path, uploaded_by) 
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [file_name, subject, grade, rating, storage_path, uploaded_by]
      );
      res.status(201).json({ msg: "File created succesfully" }); 
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// Get all documents
app.get('/documents', async (req, res) => {
  try {
      const result = await pool.query(`SELECT * FROM public."FILE"`);
      res.status(200).json(result.rows); // Returns all documents
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});


// Update a document
app.put('/documents/:id', async (req, res) => {
  const { id } = req.params;
  const { file_name, subject, grade, storage_path } = req.body;

  try {
      const result = await pool.query(
          `UPDATE public."FILE" 
           SET file_name = $1, subject = $2, grade = $3, storage_path = $4 
           WHERE file_id = $5 RETURNING *`,
          [file_name, subject, grade, storage_path, id]
      );

      if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Document not found' });
      }

      res.status(200).json(result.rows[0]); // Returns the updated document
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// Delete a document
app.delete('/documents/:id', async (req, res) => {
  const { id } = req.params;

  try {
      const result = await pool.query(
          `DELETE FROM public."FILE" WHERE file_id = $1 RETURNING *`,
          [id]
      );

      if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Document not found' });
      }

      res.status(200).json({ message: 'Document deleted successfully' });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});


//----------------------------------------------
// Security middleware
app.use(helmet());
app.use(morgan('combined'));


// Set up rate limiter for uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many upload attempts from this IP, please try again later."
});

// Set upload directory (using environment variable for flexibility)
const uploadDir = process.env.UPLOAD_DIR || './uploads/';


// Function to sanitize file names
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9_\-.]/g, '_');
}

// Set up Multer storage engine
const storage = multer.diskStorage({
  destination: uploadDir,  // Set the destination folder for uploads
  filename: function(req, file, cb) {
      const sanitizedFilename = sanitizeFilename(file.fieldname + '-' + Date.now() + path.extname(file.originalname));
      cb(null, sanitizedFilename);  // Set the sanitized file name with extension
  }
});

// Check file type
function checkFileType(file, cb) {
  // Allowed extensions
  const filetypes = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    console.log('File type error: Documents Only!');
    cb('Error: Documents Only!');  // Pass error message to callback
}
}

// Initialize upload with file validation
const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 },  // Set file size limit to 20MB
  fileFilter: function(req, file, cb) {
      file.originalname = sanitizeFilename(file.originalname);  // Sanitize file name
      checkFileType(file, cb);
  }
}).single('document');  // Specify the input field name

// Convert upload function to a Promise-based one for async/await use
const uploadAsync = util.promisify(upload);

// Create a route to handle the file upload
app.post('/upload', uploadLimiter, async (req, res) => {
  try {
      await uploadAsync(req, res);  // Await the upload process
      if (!req.file) {
          return res.status(400).send({ message: 'No file selected!' });
      }
      res.status(200).send({
          message: 'Document uploaded!',
          file: `uploads/${req.file.filename}`
      });
  } catch (err) {
      console.log('Caught error:', err);  // Log the caught error for debugging
      res.status(400).send({ message: err.message || err });  // Send the error message
  }
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Start server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
