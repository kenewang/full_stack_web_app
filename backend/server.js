//----20 Sep -------------------------------
const axios = require('axios'); // Import axios

const FormData = require('form-data'); // Import FormData to handle multipart data

const fs = require('fs');


//------------------------------------------



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
  const { email, password, Fname, Lname, username, role } = req.body;

  // Function to check if the email format is valid
  function validEmail(userEmail) {
    return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(userEmail);
  }



  // Validation for registration route
  if (req.path === "/register") {
    // Check if all required fields are provided
    if (![email, Fname, Lname, username, password].every(Boolean)) {
      return res.status(400).json({ msg: "Please provide all required fields: fname, lname, username, email, and password" });
    }

    // Check if the provided email is valid
    if (!validEmail(email)) {
      return res.status(400).json({ msg: "Invalid Email" });
    }

    
  }

  // Validation for login route
  else if (req.path === "/login") {
    // Check if both email and password are provided
    if (![email, password].every(Boolean)) {
      return res.status(400).json({ msg: "Please provide both email and password" });
    }

    // Check if the provided email is valid
    if (!validEmail(email)) {
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
  const { email, Fname, Lname, username, password} = req.body;

  try {
    // Check if the user already exists in the database
    const user = await pool.query("SELECT * FROM public.\"USER\" WHERE email = $1", [email]);

    if (user.rows.length > 0) {
      return res.status(401).json({ msg: "User already exists" }); // Respond if the user already exists
    }

    const salt = await bcrypt.genSalt(10); // Generate a salt for password hashing
    const bcryptPassword = await bcrypt.hash(password, salt); // Hash the user's password

    // Insert the new user into the "USER" table
    let newUser = await pool.query(
      `INSERT INTO public."USER" 
      (fname, lname, username, password_hash, email, is_active, role) 
      VALUES ($1, $2, $3, $4, $5, $6, 'open-access') RETURNING *`,
      [Fname, Lname, username, bcryptPassword, email, true]
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
    // Check if the user exists in the database by email
    const user = await pool.query("SELECT * FROM public.\"USER\" WHERE email = $1", [email]);

    if (user.rows.length === 0) {
      // Return a 401 Unauthorized response if the user does not exist
      return res.status(401).json({ msg: "Invalid Credentials. User not found." });
    }

    // Compare the provided password with the hashed password in the database
    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);

    if (!validPassword) {
      // Return a 401 Unauthorized response if the password is incorrect
      return res.status(401).json({ msg: "Invalid Credentials. Incorrect password." });
    }

    // Update the last_login field with the current timestamp
    await pool.query("UPDATE public.\"USER\" SET last_login = NOW() WHERE user_id = $1", [user.rows[0].user_id]);

    // Generate a JWT token for the user
    const jwtToken = jwtGenerator(user.rows[0].user_id);
    return res.json({ jwtToken }); // Send the JWT token back to the user
  } catch (err) {
    console.error(err.message);
    // Return a 500 Internal Server Error if something goes wrong
    res.status(500).send("Server error");
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






//-----20 Sep Document Creationg and upload to Seaweedfs ----------------
// Set up rate limiter for uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many upload attempts from this IP, please try again later."
});

// Function to sanitize file names
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9_\-.]/g, '_');
}

// Check file type for allowed extensions
function checkFileType(file, cb) {
  const filetypes = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt/; // Allowed extensions
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    console.log('File type error: Documents Only!');
    cb('Error: Documents Only!');  // Pass error message to callback
  }
}

// Multer setup without local storage, just validation
const storage = multer.memoryStorage(); // Store in memory buffer, not locally
const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 },  // Set file size limit to 20MB
  fileFilter: function(req, file, cb) {
    file.originalname = sanitizeFilename(file.originalname);  // Sanitize file name
    checkFileType(file, cb);  // Check file type
  }
}).single('file');  // Specify the input field name for file upload

// Convert Multer to Promise-based for async/await
const uploadAsync = util.promisify(upload);

// Upload file to SeaweedFS and create a document
app.post('/documents', uploadLimiter, async (req, res) => {
  try {
    // Step 1: Perform the file upload using multer (stored in memory)
    await uploadAsync(req, res);
    if (!req.file) {
      return res.status(400).send({ message: 'No file selected!' });
    }

    // Step 2: Create FormData and append the file for SeaweedFS upload
    const formData = new FormData();
    formData.append('file', req.file.buffer, req.file.originalname); // Use file from memory

    // Step 3: Send the file to SeaweedFS
    const seaweedResponse = await axios.post('http://localhost:9333/submit', formData, {
      headers: formData.getHeaders() // Set the headers for multipart/form-data
    });

    //Log the full SeaweedFS response to check its structure
    console.log(seaweedResponse.data); // 

   //Extract the fileUrl and ensure it's properly formatted
    let storagePath = seaweedResponse.data.fileUrl;

    // Ensure the storage path has the correct protocol (SeaweedFS response lacks "http://")
    if (!storagePath.startsWith('http')) {
      storagePath = `http://${storagePath}`;
    }

    // Check if storagePath is correctly set

    if (!storagePath) {
      return res.status(500).json({ message: "Failed to get storage path from SeaweedFS" });
    }

    // Step 5: Get the document details from the request body
    const { file_name, subject, grade, uploaded_by } = req.body;

    // Step 6: Insert the new file with an initial rating of 0 and the SeaweedFS storage path
    const result = await pool.query(
      `INSERT INTO public."FILE" (file_name, subject, grade, rating, storage_path, uploaded_by) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [file_name, subject, grade, 0, storagePath, uploaded_by]
    );

    // Step 7: Return a success message
    res.status(201).json({ msg: "File uploaded and document created successfully", file: result.rows[0] });

  } catch (err) {
    console.log('Caught error:', err);  // Log the caught error for debugging
    res.status(500).send({ message: err.message || err });  // Send the error message
  }
});


//--------------------------------------------------------------------------

//----[kenewang] Implement moderation features for approving or rejecting documents -----
//update the file’s status whenever the moderator makes a decision

app.post("/moderate-document", authorize, async (req, res) => {
  const { file_id, action, comments } = req.body;
  const moderator_id = req.user.id;


  if (!['approved', 'rejected'].includes(action)) {
    return res.status(400).json({ msg: "Invalid action" });
  }

  try {
    // Insert into MODERATION_HISTORY
    await pool.query(
      `INSERT INTO public."MODERATION_HISTORY" (file_id, moderator_id, action, comments) 
       VALUES ($1, $2, $3, $4)`,
      [file_id, moderator_id, action, comments]
    );

    // Update the file's status and return the updated file
    const updateResult = await pool.query(
      `UPDATE public."FILE" 
       SET status = $1
       WHERE file_id = $2
       RETURNING *`,  // Return the updated file to confirm the update
      [action, file_id]
    );

    // If no rows were updated, return an error
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ msg: "File not found or could not update status" });
    }

    res.status(200).json({ msg: "Document moderated successfully", updatedFile: updateResult.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});



// Rating submission route  [Kenewang]
app.post('/rate-file', authorize, async (req, res) => {
  const { file_id, rating } = req.body;
  const user_id = req.user.id;

  try {
    // Step 1: Check the status of the file
    const file = await pool.query(
      `SELECT status FROM public."FILE" WHERE file_id = $1`,
      [file_id]
    );

    if (file.rows.length === 0) {
      return res.status(404).json({ msg: "File not found" });
    }

    const fileStatus = file.rows[0].status;

    // Step 2: Only allow rating if the file is approved
    if (fileStatus !== 'approved') {
      return res.status(403).json({ msg: "File cannot be rated until it is approved" });
    }

    // Step 3: Insert the rating if the file is approved
    await pool.query(
      `INSERT INTO public."RATING" (file_id, user_id, rating) 
       VALUES ($1, $2, $3) RETURNING *`,
      [file_id, user_id, rating]
    );

    res.status(201).json({ msg: "Rating submitted successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});


//demonstrate to tshepi

// Start server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
