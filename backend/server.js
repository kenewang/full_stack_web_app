
const axios = require('axios'); 
const FormData = require('form-data'); 
const fs = require('fs');
const libre = require('libreoffice-convert');
const nodemailer = require('nodemailer');  
const crypto = require('crypto');
const stream = require('stream');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { Document, Packer, Paragraph, Footer, AlignmentType, TextRun } = require('docx');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const express = require("express");
const app = express(); 
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
const session = require("express-session");

const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger options
const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "Share2Teach API",
      version: "1.0.0",
      description: "API documentation for Share2Teach web app",
      contact: {
        name: "Lennies"
      }
    },
    servers: [
      {
        url: "http://localhost:3000" 
      }
    ]
  },
  apis: [path.join(__dirname, 'server.js')], // Point to the server.js file for Swagger docs
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Swagger route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use(cors());

// Database connection
const pool = new Pool({
  host: "localhost",
  user: "postgres",
  password: process.env.DB_PASSWORD, // Use environment variable for sensitive data
  port: 5432,
  database: "share2teach_db" //change this depending of the name of your database
});

// Initialize session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,  // Use a secure secret key from environment variables
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // Set to true in production to enforce HTTPS
    maxAge: 24 * 60 * 60 * 1000  // 1 day in milliseconds
  }
}));



// Middleware to validate input
function validInfo(req, res, next) {
  console.log("req.body:", req.body); // Log the incoming request body for debugging
  const {email, password, Fname, Lname, username} = req.body;

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
function jwtGenerator(user) {
  const payload = {
    user: {
      id: user.user_id,  // Make sure this is the correct field name
      email: user.email, // Add email or any other information if necessary
      role: user.role,  // Add the user's role to the token payload

      token_version: user.token_version // Add token version for validation

    }
  };
  // Sign and return the token with an expiration time of 1 hour
  return jwt.sign(payload, process.env.jwtSecret, { expiresIn: "1h" });
}

// Updated Authorization Middleware [24 Sep]
function authorize(req, res, next) {
  const token = req.header("jwt_token"); // Get the token from the request headers
  if (!token) {
    return res.status(403).json({ msg: "Authorization denied" }); // Deny access if no token is provided
  }

  try {
    const verify = jwt.verify(token, process.env.jwtSecret); // Verify the token
    console.log("Decoded Token:", verify); // Add this to check the decoded token
    req.user = verify.user; // Attach the user info from the token to the request object

    // Check if token_version matches the current version in the database
    pool.query("SELECT token_version FROM public.\"USER\" WHERE user_id = $1", [req.user.id], (err, result) => {
      if (err) {
        return res.status(500).json({ msg: "Server error" });
      }

      if (result.rows.length === 0) {
        return res.status(401).json({ msg: "User not found" });
      }

      const currentTokenVersion = result.rows[0].token_version;
      if (currentTokenVersion !== req.user.token_version) {
        return res.status(401).json({ msg: "Token is invalid due to version mismatch" });
      }

      // Proceed to the next middleware or route handler
      next();
    });
  } catch (err) {
    console.error(err.message);
    res.status(401).json({ msg: "Token is not valid" });
  }
}

// Function to log user actions [Kenewang 24 Sep]
async function logUserAction(user_id, activity_type, description) {
  try {
    await pool.query(
      `INSERT INTO public."ACTIVITY_LOG" (user_id, activity_type, description) 
       VALUES ($1, $2, $3)`,
      [user_id, activity_type, description]
    );
  } catch (err) {
    console.error("Error logging user action:", err.message);
  }
}

// Function to log user navigation
async function logPageVisit(user_id, page_visited, time_spent = null) {
  try {
    await pool.query(
      `INSERT INTO public."ANALYTICS" (user_id, page_visited, time_spent) 
       VALUES ($1, $2, $3)`,
      [user_id, page_visited, time_spent]
    );
  } catch (err) {
    console.error("Error logging page visit:", err.message);
  }
}

// Routes

// Root route to check if the server is running
app.get("/", (req, res) => {
  res.send("Server is now running");
});


/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - Fname
 *               - Lname
 *               - username
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 description: The user's email
 *               Fname:
 *                 type: string
 *                 description: The user's first name
 *               Lname:
 *                 type: string
 *                 description: The user's last name
 *               username:
 *                 type: string
 *                 description: The user's chosen username
 *               password:
 *                 type: string
 *                 description: The user's password
 *     responses:
 *       200:
 *         description: User successfully registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jwtToken:
 *                   type: string
 *                   description: The JWT token for the newly registered user
 *       400:
 *         description: Invalid input data or missing fields
 *       401:
 *         description: User already exists
 *       500:
 *         description: Server error
 */

// Registration route
app.post("/register", validInfo, async (req, res) => {
  const { email, Fname, Lname, username, password } = req.body;

  try {
    // Check if the user already exists in the database
    const user = await pool.query("SELECT * FROM public.\"USER\" WHERE email = $1", [email]);

    if (user.rows.length > 0) {
      return res.status(401).json({ msg: "User already exists" }); // Respond if the user already exists
    }

    const salt = await bcrypt.genSalt(10); // Generate a salt for password hashing
    const bcryptPassword = await bcrypt.hash(password, salt); // Hash the user's password

    // Insert the new user into the "USER" table [24 Sep Kenewang]
    let newUser = await pool.query(
      `INSERT INTO public."USER" 
      (fname, lname, username, password_hash, email, is_active, role) 
      VALUES ($1, $2, $3, $4, $5, $6, 'open-access') RETURNING *`,
      [Fname, Lname, username, bcryptPassword, email, true]
    );

    // Log the user registration action
    await logUserAction(newUser.rows[0].user_id, 'register', 'New user registered');

    const jwtToken = jwtGenerator(newUser.rows[0]); // Generate a JWT token for the new user
    return res.json({ jwtToken }); // Respond with the token
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error"); // Respond with a server error message if something goes wrong
  }
});



/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login a user
 *     description: Authenticates a user and generates a JWT token
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 description: The user's email address
 *               password:
 *                 type: string
 *                 description: The user's password
 *     responses:
 *       200:
 *         description: User successfully logged in and JWT token returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jwtToken:
 *                   type: string
 *                   description: The JWT token for the authenticated user
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Invalid credentials or user not found
 *       500:
 *         description: Server error
 */

// Login route
app.post("/login", validInfo, async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await pool.query("SELECT * FROM public.\"USER\" WHERE email = $1", [email]);

    if (user.rows.length === 0) {
      return res.status(401).json({ msg: "Invalid Credentials. User not found." });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);

    if (!validPassword) {
      return res.status(401).json({ msg: "Invalid Credentials. Incorrect password." });
    }

    await pool.query("UPDATE public.\"USER\" SET last_login = NOW() WHERE user_id = $1", [user.rows[0].user_id]);

    const jwtToken = jwtGenerator(user.rows[0]);
    res.json({ jwtToken });

    // Log the login action [24 Sep]
    await logUserAction(user.rows[0].user_id, "login", "User logged in successfully");

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});



/**
 * @swagger
 * /logout:
 *   post:
 *     summary: Logout a user
 *     description: Logs out the user by invalidating their JWT token and destroying their session.
 *     tags:
 *       - User
 *     security:
 *       - bearerAuth: []  # Requires JWT token
 *     responses:
 *       200:
 *         description: User successfully logged out and token invalidated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   description: Success message confirming the logout
 *       401:
 *         description: Unauthorized, no valid token provided
 *       500:
 *         description: Server error
 */



//Logout Route

app.post("/logout", authorize, async (req, res) => {
  try {
    // Increment the token_version to invalidate the current token
    await pool.query("UPDATE public.\"USER\" SET token_version = token_version + 1 WHERE user_id = $1", [req.user.id]);

    // Log the logout action [24 Sep]
    await logUserAction(req.user.id, 'logout', 'User logged out and token invalidated');

    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ msg: "Error logging out" });
      }
      return res.json({ msg: "Successfully logged out. Token is now invalid." });
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Forgot Password Route
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  
  try {
    // Check if user exists
    const user = await pool.query("SELECT * FROM public.\"USER\" WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(400).json({ msg: "User with this email does not exist" });
    }
    
    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiration = Date.now() + 3600000; // Token expires in 1 hour (UNIX timestamp)
    
    // Store reset token and expiration in database
    await pool.query(
      "UPDATE public.\"USER\" SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3",
      [resetToken, tokenExpiration, email]
    );
    
    // Send reset email
    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'Password Reset Request',
      text: `You have requested to reset your password. Please click the link to reset: ${resetLink}`
    };
    
    transporter.sendMail(mailOptions, async (error, info) => {
      if (error) {
        console.error("Error sending mail:", error);
        return res.status(500).json({ msg: "Error sending reset email" });
      }

      // Log the password reset request action
      await logUserAction(user.rows[0].user_id, "password_reset_request", `Password reset link sent to ${email}`);
      
      res.json({ msg: `Password reset link sent to ${email}` });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});



/**
 * @swagger
 * /reset-password/{token}:
 *   post:
 *     summary: Reset password using a valid reset token
 *     description: Allows the user to reset their password by providing a valid reset token. The token is checked for validity and expiration.
 *     tags:
 *       - Password
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: The new password
 *               confirmPassword:
 *                 type: string
 *                 description: The confirmation for the new password
 *     responses:
 *       200:
 *         description: Password successfully reset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   description: Success message confirming password reset
 *       400:
 *         description: Invalid or expired token, or passwords do not match
 *       500:
 *         description: Server error
 */


//password reset route

app.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  // Check if passwords match
  if (password !== confirmPassword) {
    return res.status(400).json({ msg: "Passwords do not match" });
  }

  try {
    // Find user by reset token and check if the token is still valid
    const user = await pool.query(
      `SELECT * FROM public."USER" WHERE reset_password_token = $1 AND reset_password_expires > EXTRACT(EPOCH FROM NOW()) * 1000`,
      [token]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ msg: "Invalid or expired reset token" });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const bcryptPassword = await bcrypt.hash(password, salt);

    // Update the password and clear the reset token
    await pool.query(
      "UPDATE public.\"USER\" SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE user_id = $2",
      [bcryptPassword, user.rows[0].user_id]
    );

    // Log the password reset action
    await logUserAction(user.rows[0].user_id, "password_reset", "User successfully reset password");

    res.json({ msg: "Password successfully reset" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL, // Your email
    pass: process.env.EMAIL_PASSWORD // Your email password
  }
});


/**
 * @swagger
 * /admin/assign-role:
 *   put:
 *     summary: Assign or update a user's role
 *     description: Allows an admin to assign or update the role of a specific user.
 *     tags:
 *       - Admin
 *     security:
 *       - jwt_token: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: integer
 *                 description: ID of the user whose role is being updated
 *               role:
 *                 type: string
 *                 description: The new role to assign to the user
 *             required:
 *               - user_id
 *               - role
 *     responses:
 *       200:
 *         description: User role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   description: Success message confirming the role update
 *                 user:
 *                   type: object
 *                   description: The updated user object
 *       403:
 *         description: Access denied. Only admins can assign roles
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */


// Route for admin to assign user roles
app.put('/admin/assign-role', authorize, async (req, res) => {
  const { user_id, role } = req.body;
  console.log("User Role:", req.user.role);  // Add this to log the role from the JWT

  try {
    // Check if the logged-in user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: "Access denied. Only admins can assign roles." });
    }

    // Update the user's role
    const result = await pool.query(
      `UPDATE public."USER" SET role = $1 WHERE user_id = $2 RETURNING *`,
      [role, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "User not found" });
    }

     // Log the role assignment action [Kenewang 24 Sep]
     await logUserAction(req.user.id, "role_assignment", `Assigned role '${role}' to user with ID ${user_id}`);

    res.status(200).json({ msg: `User role updated to ${role}`, user: result.rows[0] });

    
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});



/**
 * @swagger
 * /active_user:
 *   post:
 *     summary: Fetch the active (logged-in) user's details
 *     description: Returns the first and last name of the currently logged-in user based on the JWT token.
 *     tags:
 *       - User
 *     security:
 *       - jwt_token: []
 *     responses:
 *       200:
 *         description: Successfully fetched active user details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 Fname:
 *                   type: string
 *                   description: First name of the logged-in user
 *                 Lname:
 *                   type: string
 *                   description: Last name of the logged-in user
 *       500:
 *         description: Server error
 */


// Route to fetch active (logged-in)
app.post("/active_user", authorize, async (req, res) => {
  try {
    const user = await pool.query("SELECT Fname, Lname FROM public.\"USER\" WHERE user_id = $1", [req.user.id]);
    res.json(user.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});



/**
 * @swagger
 * /documents:
 *   get:
 *     summary: Fetch a list of documents
 *     description: Retrieves a list of approved documents for non-logged-in users. Admins and moderators can view all documents, regardless of status.
 *     tags:
 *       - Documents
 *     security:
 *       - jwt_token: []   # Optional, non-logged-in users can still access
 *     responses:
 *       200:
 *         description: A list of documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   file_id:
 *                     type: integer
 *                     description: Unique ID of the file
 *                   file_name:
 *                     type: string
 *                     description: Name of the document
 *                   subject:
 *                     type: integer
 *                     description: Subject ID related to the document
 *                   grade:
 *                     type: integer
 *                     description: Grade level of the document
 *                   rating:
 *                     type: number
 *                     description: Average rating of the document
 *                   storage_path:
 *                     type: string
 *                     description: Path to the file storage location
 *                   uploaded_by:
 *                     type: integer
 *                     description: ID of the user who uploaded the document
 *                   status:
 *                     type: string
 *                     description: Status of the document (e.g., approved, pending)
 *                   upload_date:
 *                     type: string
 *                     format: date-time
 *                     description: Date and time the document was uploaded
 *       500:
 *         description: Server error
 */


// Get all documents

// Document list route for both logged-in and anonymous users
app.get('/documents', async (req, res) => {
  try {
    let query = `
      SELECT f.file_id, f.file_name, g.grade_name, s.subject_name, f.rating, f.storage_path 
      FROM public."FILE" f
      JOIN public."GRADE" g ON f.grade = g.grade_id
      JOIN public."SUBJECT" s ON f.subject = s.subject_id
      WHERE f.status = 'approved'`; // Default for non-logged-in users

    const values = [];

    // Check if the user is logged in
    let userRole = null;
    let user_id = null; // Default is null for non-logged-in users

    // If JWT is provided, extract the user info
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1]; // Assuming 'Bearer <token>'
        const decoded = jwt.verify(token, process.env.jwtSecret); // Verify and decode the token
        userRole = decoded.user.role; // Get the user's role
        user_id = decoded.user.id; // Get the user's ID
      } catch (err) {
        console.error("JWT error: ", err.message);
      }
    }

    // If the user is logged in and is an admin or moderator, fetch all documents
    if (userRole === 'admin' || userRole === 'moderator') {
      query = `
        SELECT f.file_id, f.file_name, g.grade_name, s.subject_name, f.rating, f.storage_path 
        FROM public."FILE" f
        JOIN public."GRADE" g ON f.grade = g.grade_id
        JOIN public."SUBJECT" s ON f.subject = s.subject_id`; // Fetch all documents for admin and moderator
    }

    // Fetch the documents from the database
    const result = await pool.query(query, values);

    // Log the page visit for document viewing
    await logPageVisit(user_id, "Documents List", null); // Log the page visit with user_id

    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



/**
 * @swagger
 * /documents/{id}:
 *   put:
 *     summary: Update an existing document
 *     description: Allows users with specific roles (admin, moderator, educator) to update a document's details, such as file name, subject, and grade.
 *     tags:
 *       - Documents
 *     security:
 *       - jwt_token: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the document to update
 *       - in: body
 *         name: document
 *         description: The document details to update
 *         schema:
 *           type: object
 *           required:
 *             - file_name
 *             - subject
 *             - grade
 *           properties:
 *             file_name:
 *               type: string
 *               description: The new name of the document
 *             subject:
 *               type: integer
 *               description: The new subject ID of the document
 *             grade:
 *               type: integer
 *               description: The new grade level of the document
 *     responses:
 *       200:
 *         description: Document updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 file_id:
 *                   type: integer
 *                 file_name:
 *                   type: string
 *                 subject:
 *                   type: integer
 *                 grade:
 *                   type: integer
 *                 rating:
 *                   type: number
 *                 status:
 *                   type: string
 *       403:
 *         description: Access denied. Only authorized roles (admin, moderator, educator) can update documents.
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */


// Route to Update a document  
app.put('/documents/:id', authorize, async (req, res) => {
  const { id } = req.params;
  const { file_name, subject, grade } = req.body;

  try {
    // Check if the user has the correct role
    const allowedRoles = ['admin', 'moderator', 'educator'];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Update the document in the database
    const result = await pool.query(
      `UPDATE public."FILE" 
       SET file_name = $1, subject = $2, grade = $3
       WHERE file_id = $4 RETURNING *`,
      [file_name, subject, grade, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Log the document update action
    await logUserAction(req.user.id, 'update_document', `Updated document with ID: ${id}`);

    // Return the updated document
    res.status(200).json(result.rows[0]); 
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * @swagger
 * /documents/{id}:
 *   delete:
 *     summary: Delete a document
 *     description: Allows users with specific roles (admin, moderator, educator) to delete a document by its ID.
 *     tags:
 *       - Documents
 *     security:
 *       - jwt_token: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the document to delete
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Document deleted successfully"
 *       403:
 *         description: Access denied. Only authorized roles (admin, moderator, educator) can delete documents.
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */


// Route to Delete a document  
app.delete('/documents/:id', authorize, async (req, res) => {
  const { id } = req.params;

  try {

    
    // Check if the user has the correct role
    allowedRoles = ['admin', 'moderator', 'educator'];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

      const result = await pool.query(
          `DELETE FROM public."FILE" WHERE file_id = $1 RETURNING *`,
          [id]
      );

      if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Document not found' });
      }


      // Log the document deletion action [Kenewang 24 Sep]
      await logUserAction(req.user.id, "document_deletion", `Deleted document with ID ${id}`);


      res.status(200).json({ message: 'Document deleted successfully' });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});




// Security middleware
app.use(helmet());
app.use(morgan('combined'));






// Function to add a watermark to the PDF (at the middle footer)
async function addWatermarkToPDF(pdfBuffer) {
  // Load the PDF document from the provided buffer
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  // Embed the standard font to use for the watermark
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Define the watermark text and its properties
  const watermarkText = 'Share2Teach License - CC BY-NC-ND 4.0';
  const fontSize = 12;
  const marginBottom = 20;  // Distance from the bottom of the page

  // Iterate through all pages to add the watermark
  for (const page of pages) {
    const { width } = page.getSize();  // Get page dimensions

    // Calculate the width of the text using the embedded font and the font size
    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
    const x = (width - textWidth) / 2;  // Center horizontally

    // Define the y-coordinate for placing the text at the footer (bottom)
    const y = marginBottom;  // 20 units above the bottom

    // Draw the watermark text on the page at the calculated position
    page.drawText(watermarkText, {
      x,
      y,
      size: fontSize,
      font: font,  // Use the embedded font
      color: rgb(0.5, 0.5, 0.5),  // Light grey color
    });
  }

  // Save the modified PDF to a buffer and return it
  const modifiedPdfBuffer = await pdfDoc.save();
  return modifiedPdfBuffer;
}

module.exports = addWatermarkToPDF;

// Function to add watermark to DOCX
async function addWatermarkToDocx(buffer) {
  try {
    // Load the docx file from the buffer instead of reading from the file system
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip);

    // Replace the placeholder with the watermark text
    doc.setData({
      watermark: 'Share2Teach License - CC BY-NC-ND 4.0',  // This will replace {watermark} in the document
    });

    // Render the changes (apply the watermark)
    doc.render();

    // Generate the modified docx file as a Buffer
    const updatedBuffer = doc.getZip().generate({ type: 'nodebuffer' });
    return updatedBuffer;
  } catch (error) {
    console.error("Error adding watermark to DOCX:", error);
    throw error;
  }
}

module.exports = addWatermarkToDocx;

// Function to add watermark to Excel documents
const ExcelJS = require('exceljs');

async function addWatermarkToExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);  // Load the workbook from the buffer
  
  workbook.eachSheet((sheet) => {
    // Add watermark in the footer of each worksheet
    sheet.headerFooter.oddFooter = 'Share2Teach License - CC BY-NC-ND 4.0';  // Centered in footer
  });

  // Generate the modified Excel file as a Buffer
  const modifiedBuffer = await workbook.xlsx.writeBuffer();
  return modifiedBuffer;
}

module.exports = addWatermarkToExcel;

// Function to add watermark to Powerpoint presentations
const PptxGenJS = require("pptxgenjs");

async function addWatermarkToPpt() {
  const ppt = new PptxGenJS();

  // Add a slide and watermark text
  const slide = ppt.addSlide();
  slide.addText('Content of the slide', { x: 1, y: 1, fontSize: 24 });

  // Add watermark text at the bottom
  slide.addText('Share2Teach License - CC BY-NC-ND 4.0', {
    x: 0.5,
    y: '90%',
    fontSize: 12,
    color: '808080',
    align: 'center',
  });

  // Write the presentation to a base64 string
  const pptBase64 = await ppt.write('base64');

  // Convert the base64 string to a buffer
  const buffer = Buffer.from(pptBase64, 'base64');

  return buffer;  // Return the buffer for further processing
}

module.exports = addWatermarkToPpt;

// Function to add watermark to Textfiles
async function addWatermarkToTxt(buffer) {
  const originalText = buffer.toString('utf-8');  // Convert buffer to string
  const watermarkText = '\n\nShare2Teach License - CC BY-NC-ND 4.0\n';

  // Add the watermark text at the end of the document
  const modifiedText = originalText + watermarkText;

  // Convert the modified text back to buffer
  const modifiedBuffer = Buffer.from(modifiedText, 'utf-8');
  return modifiedBuffer;
}

module.exports = addWatermarkToTxt;




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

// Helper function to upsert keywords (insert if not exists, otherwise retrieve existing ones)
async function upsertKeywords(pool, keywords) {
  const keywordIds = [];

  for (const keyword of keywords) {
    let result = await pool.query('SELECT keyword_id FROM public."KEYWORD" WHERE keyword = $1', [keyword]);

    if (result.rows.length === 0) {
      // If keyword doesn't exist, insert it
      result = await pool.query('INSERT INTO public."KEYWORD" (keyword) VALUES ($1) RETURNING keyword_id', [keyword]);
    }

    keywordIds.push(result.rows[0].keyword_id); // Store the keyword_id
  }

  return keywordIds;
}


/**
 * @swagger
 * /documents:
 *   post:
 *     summary: Upload a new document
 *     description: Allows admins, moderators, and educators to upload a document with an optional watermark, and save the document's details in the database.
 *     tags:
 *       - Documents
 *     security:
 *       - jwt_token: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to upload (supports various formats).
 *               file_name:
 *                 type: string
 *                 description: The name of the file.
 *               subject:
 *                 type: string
 *                 description: The subject related to the document.
 *               grade:
 *                 type: string
 *                 description: The grade level for the document.
 *               keywords:
 *                 type: string
 *                 description: Comma-separated keywords related to the document.
 *     responses:
 *       201:
 *         description: File uploaded successfully, and document created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   example: "File uploaded, document created, and keywords linked successfully"
 *                 file:
 *                   type: object
 *                   description: The details of the created document.
 *       400:
 *         description: Invalid request (e.g., no file selected or unsupported file format).
 *       403:
 *         description: Access denied. Only admins, moderators, and educators can upload documents.
 *       500:
 *         description: Server error.
 */




// Upload file to SeaweedFS, handle keywords, and create a document

app.post('/documents', uploadLimiter, authorize, async (req, res) => {
  try {
    console.log('Request Body:', req.body);

    // Check if the user has the correct role
    const allowedRoles = ['admin', 'moderator', 'educator'];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Only admins, moderators, and educators can upload documents.' });
    }

    // Perform the file upload using multer (stored in memory)
    await uploadAsync(req, res);

    if (!req.file) {
      return res.status(400).send({ message: 'No file selected!' });
    }

    // Add watermark depending on file type
    const mimeType = req.file.mimetype;
    if (mimeType === 'application/pdf') {
      req.file.buffer = await addWatermarkToPDF(req.file.buffer);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      req.file.buffer = await addWatermarkToDocx(req.file.buffer);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mimeType === 'application/vnd.ms-excel') {
      req.file.buffer = await addWatermarkToExcel(req.file.buffer);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || mimeType === 'application/vnd.ms-powerpoint') {
      req.file.buffer = await addWatermarkToPpt(req.file.buffer);
    } else if (mimeType === 'text/plain') {
      req.file.buffer = await addWatermarkToTxt(req.file.buffer);
    } else {
      return res.status(400).send({ message: 'Unsupported file format!' });
    }

    // Create FormData and append the file for SeaweedFS upload
    const formData = new FormData();
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    formData.append('file', bufferStream, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    // Send the file to SeaweedFS
    const seaweedResponse = await axios.post('http://localhost:9333/submit', formData, {
      headers: formData.getHeaders()
    });

    let storagePath = seaweedResponse.data.fileUrl;
    if (!storagePath.startsWith('http')) {
      storagePath = `http://${storagePath}`;
    }

    // Get the document details from the request body
    const { file_name, subject, grade, keywords } = req.body;

    // Use the authenticated user's ID for `uploaded_by`
    const uploaded_by = req.user.id;

    // Insert the new file with an initial rating of 0 and the SeaweedFS storage path
    const fileResult = await pool.query(
      `INSERT INTO public."FILE" (file_name, subject, grade, rating, storage_path, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [file_name, subject, grade, 0, storagePath, uploaded_by]
    );

    const fileId = fileResult.rows[0].file_id;

    // Upsert (insert or find existing) keywords
    const keywordList = keywords.split(',').map(k => k.trim());
    const keywordIds = await upsertKeywords(pool, keywordList);

    // Insert into the file_keyword table to link file and keywords
    for (const keywordId of keywordIds) {
      await pool.query('INSERT INTO public."FILE_KEYWORD" (file_id, keyword_id) VALUES ($1, $2)', [fileId, keywordId]);
    }

    // Log the file upload action
    await logUserAction(req.user.id, "file_upload", `Uploaded file: ${req.body.file_name}`);

    res.status(201).json({ msg: "File uploaded, document created, and keywords linked successfully", file: fileResult.rows[0] });
  } catch (err) {
    console.error('Caught error:', err);
    res.status(500).send({ message: err.message || err });
  }
});


/**
 * @swagger
 * /search-documents:
 *   get:
 *     summary: Search for documents
 *     description: Allows users to search for documents based on various criteria such as file name, subject, grade, rating, uploader, status, and keywords. Supports both logged-in and anonymous users.
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: query
 *         name: file_name
 *         schema:
 *           type: string
 *         required: false
 *         description: The name of the file to search for.
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *         required: false
 *         description: The subject associated with the documents.
 *       - in: query
 *         name: grade
 *         schema:
 *           type: string
 *         required: false
 *         description: The grade level of the documents.
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *           format: double
 *         required: false
 *         description: Minimum rating of the documents to search for.
 *       - in: query
 *         name: uploaded_by
 *         schema:
 *           type: string
 *         required: false
 *         description: ID of the user who uploaded the documents.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         required: false
 *         description: The status of the documents (e.g., approved, pending).
 *       - in: query
 *         name: keywords
 *         schema:
 *           type: string
 *         required: false
 *         description: Comma-separated keywords to search for in the documents.
 *     responses:
 *       200:
 *         description: Successfully retrieved the list of documents matching the search criteria.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   file_id:
 *                     type: integer
 *                     description: The unique ID of the file.
 *                   file_name:
 *                     type: string
 *                     description: The name of the file.
 *                   subject:
 *                     type: string
 *                     description: The subject of the document.
 *                   grade:
 *                     type: string
 *                     description: The grade level of the document.
 *                   rating:
 *                     type: number
 *                     format: double
 *                     description: The rating of the document.
 *                   storage_path:
 *                     type: string
 *                     description: The path where the document is stored.
 *                   uploaded_by:
 *                     type: integer
 *                     description: ID of the user who uploaded the document.
 *       500:
 *         description: Server error.
 */


// Document search route for both logged-in and anonymous users 
app.get('/search-documents', async (req, res) => {
  const { file_name, subject_name, grade_name, rating, uploaded_by, status, keywords } = req.query;

  try {
    // Build the query with dynamic filters
    let query = `
      SELECT DISTINCT f.*
      FROM public."FILE" f
      LEFT JOIN public."FILE_KEYWORD" fk ON f.file_id = fk.file_id
      LEFT JOIN public."KEYWORD" k ON fk.keyword_id = k.keyword_id
      WHERE 1 = 1
    `;

    const values = [];
    let valueIndex = 1;

    if (file_name) {
      query += ` AND f.file_name ILIKE $${valueIndex++}`;
      values.push(`%${file_name}%`);
    }

    if (subject_name) {
      query += ` AND f.subject_name ILIKE $${valueIndex++}`;
      values.push(`%${subject_name}%`);
    }

    if (grade_name) {
      query += ` AND f.grade_name = $${valueIndex++}`;
      values.push(grade_name);
    }

    if (rating) {
      query += ` AND f.rating >= $${valueIndex++}`;
      values.push(rating);
    }

    if (uploaded_by) {
      query += ` AND f.uploaded_by = $${valueIndex++}`;
      values.push(uploaded_by);
    }

    if (status) {
      query += ` AND f.status = $${valueIndex++}`;
      values.push(status);
    }

    if (keywords) {
      const keywordList = keywords.split(',').map(k => k.trim());
      query += ` AND k.keyword ILIKE ANY($${valueIndex++})`;
      values.push(keywordList.map(kw => `%${kw}%`));
    }

    // Execute the query
    const result = await pool.query(query, values);

    // Log the search action
    let user_id = null;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.jwtSecret);
        user_id = decoded.user.id;
      } catch (err) {
        console.error("JWT error: ", err.message);
      }
    }

    await logPageVisit(user_id, 'Document Search', null);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * @swagger
 * /moderate-document:
 *   post:
 *     summary: Moderate a document
 *     description: Allows admins and moderators to approve or reject documents. The action taken, along with comments, is logged for reference.
 *     tags:
 *       - Moderation
 *     security:
 *       - Bearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               file_id:
 *                 type: integer
 *                 description: The ID of the document being moderated.
 *               action:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 description: The action to take on the document (either 'approved' or 'rejected').
 *               comments:
 *                 type: string
 *                 description: Optional comments about the moderation action.
 *     responses:
 *       200:
 *         description: Document moderated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   description: Confirmation message.
 *                 updatedFile:
 *                   type: object
 *                   description: The updated document details.
 *       403:
 *         description: Access denied. Only admins and moderators can moderate documents.
 *       400:
 *         description: Invalid action provided.
 *       404:
 *         description: Document not found or could not update status.
 *       500:
 *         description: Server error.
 */


//Implement moderation features for approving or rejecting documents -----
//update the file’s status whenever the moderator makes a decision

app.post("/moderate-document", authorize, async (req, res) => {
  const { file_id, action, comments } = req.body;
  const moderator_id = req.user.id;

  allowedRoles = ['admin', 'moderator'];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Failed. Only admins and moderators can moderate documents.' });
  }


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


    // Log the moderation action [Kenewang 24 Sep]
    await logUserAction(moderator_id, "document_moderation", `Moderated document with ID ${file_id}. Action: ${action}, Comments: ${comments || 'No comments'}`);

    res.status(200).json({ msg: "Document moderated successfully", updatedFile: updateResult.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});


/**
 * @swagger
 * /rate-file:
 *   post:
 *     summary: Rate a document
 *     description: Allows authenticated users to rate a document. If the user is not logged in, the rating is stored using a session ID. The average rating of the document is updated accordingly.
 *     tags:
 *       - Rating
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               file_id:
 *                 type: integer
 *                 description: The ID of the document being rated.
 *               rating:
 *                 type: integer
 *                 description: The rating given to the document (must be between 1 and 5).
 *     responses:
 *       200:
 *         description: Rating submitted successfully, along with the updated average rating.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   description: Confirmation message.
 *                 averageRating:
 *                   type: number
 *                   format: float
 *                   description: The new average rating for the document.
 *       400:
 *         description: Validation error due to missing file ID or rating, or if the rating is outside the allowed range (1-5).
 *       404:
 *         description: Document not found.
 *       500:
 *         description: Server error.
 */



// Route to rate a file [Otshepeng 24 Sep]

app.post("/rate-file", async (req, res) => {
  const { file_id, rating } = req.body;

  // Check if the request is authenticated with JWT
  const token = req.header("jwt_token");
  let user_id = null;

  if (token) {
    try {
      const verify = jwt.verify(token, process.env.jwtSecret);
      user_id = verify.user.id;
    } catch (err) {
      return res.status(401).json({ msg: "Token is not valid" });
    }
  }

  // Validate input
  if (!file_id || !rating) {
    return res.status(400).json({ msg: "Please provide a file_id and rating" });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ msg: "Rating must be between 1 and 5" });
  }

  try {
    // Check if the file exists
    const fileExists = await pool.query("SELECT * FROM public.\"FILE\" WHERE file_id = $1", [file_id]);
    if (fileExists.rows.length === 0) {
      return res.status(404).json({ msg: "File not found" });
    }

    if (user_id) {
      // Authenticated user: Store rating by user_id
      const existingRating = await pool.query(
        "SELECT * FROM public.\"RATING\" WHERE file_id = $1 AND user_id = $2",
        [file_id, user_id]
      );

      if (existingRating.rows.length > 0) {
        await pool.query(
          'UPDATE public."RATING" SET rating = $1 WHERE file_id = $2 AND user_id = $3',
          [rating, file_id, user_id]
        );
      } else {
        await pool.query(
          'INSERT INTO public."RATING" (file_id, user_id, rating) VALUES ($1, $2, $3)',
          [file_id, user_id, rating]
        );
      }

      // Log page visit for the authenticated user
      await logPageVisit(user_id, "Rate File",null);
      
    } else {
      // Open Access User: Store rating by session ID
      const sessionId = req.sessionID; 

      const existingRating = await pool.query(
        "SELECT * FROM public.\"RATING\" WHERE file_id = $1 AND session_id = $2",
        [file_id, sessionId]
      );

      if (existingRating.rows.length > 0) {
        await pool.query(
          'UPDATE public."RATING" SET rating = $1 WHERE file_id = $2 AND session_id = $3',
          [rating, file_id, sessionId]
        );
      } else {
        await pool.query(
          'INSERT INTO public."RATING" (file_id, session_id, rating) VALUES ($1, $2, $3)',
          [file_id, sessionId, rating]
        );
      }

      // Log page visit for anonymous user (open-access user)
      await logPageVisit(null, "Rate File", null);
    }

    // Calculate the new average rating for the file
    const newAverageRating = await pool.query(
      'SELECT AVG(rating) AS avg_rating FROM public."RATING" WHERE file_id = $1',
      [file_id]
    );

    const averageRating = parseFloat(newAverageRating.rows[0].avg_rating).toFixed(1);

    // Update the file's average rating
    await pool.query(
      'UPDATE public."FILE" SET rating = $1 WHERE file_id = $2',
      [averageRating, file_id]
    );

    res.status(200).json({ msg: "Rating submitted successfully", averageRating });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});


/**
 * @swagger
 * /report-document:
 *   post:
 *     summary: Report a document
 *     description: Allows authenticated users to report a document for review. The report includes the document ID, the reporter's ID (if logged in), and the reason for the report. The report status is set to 'pending'.
 *     tags:
 *       - Reporting
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               file_id:
 *                 type: integer
 *                 description: The ID of the document being reported.
 *               reason:
 *                 type: string
 *                 description: The reason for reporting the document.
 *     responses:
 *       201:
 *         description: Report submitted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   description: Confirmation message indicating the report was submitted.
 *       400:
 *         description: Validation error due to missing file ID or reason for the report.
 *       500:
 *         description: Server error.
 */


//---document reporting route

app.post('/report-document', authorize, async (req, res) => {
  const { file_id, reason } = req.body;
  let reporter_id = null; // Default is null for anonymous users

  // Check if the user is logged in (using the authorization middleware)
  if (req.user) {
    reporter_id = req.user.id;  // Get the reporter's user ID if logged in
  }
  
  try {
    // Insert a new report into the database
    await pool.query(
      `INSERT INTO public."REPORT" (file_id, reporter_id, reason, status)
       VALUES ($1, $2, $3, 'pending')`,
      [file_id, reporter_id, reason]
    );

    // Log the document report action [27 Sep]
    await logUserAction(reporter_id, 'report_document', `Reported document with ID: ${file_id}`);

    res.status(201).json({ msg: "Report submitted successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});


/**
 * @swagger
 * /reports:
 *   get:
 *     summary: Get all pending reports
 *     description: Fetches all pending reports submitted by users. Only accessible by users with 'admin' or 'moderator' roles.
 *     tags:
 *       - Reporting
 *     responses:
 *       200:
 *         description: A list of pending reports successfully retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   report_id:
 *                     type: integer
 *                     description: The ID of the report.
 *                   file_id:
 *                     type: integer
 *                     description: The ID of the reported document.
 *                   reason:
 *                     type: string
 *                     description: The reason for reporting the document.
 *                   status:
 *                     type: string
 *                     description: The current status of the report.
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     description: The timestamp when the report was created.
 *                   reporter_fname:
 *                     type: string
 *                     description: The first name of the user who reported the document.
 *                   reporter_lname:
 *                     type: string
 *                     description: The last name of the user who reported the document.
 *       403:
 *         description: Access denied. Only admins and moderators can view reports.
 *       500:
 *         description: Server error.
 */


// Get all pending reports (for moderators) route
app.get('/reports', authorize, async (req, res) => {
  try {
    // Check if the user has the correct role
    const allowedRoles = ['admin', 'moderator'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Only admins and Moderators can view reports.' });
 }



    // Fetch all pending reports
    const result = await pool.query(`
      SELECT r.report_id, r.file_id, r.reason, r.status, r.created_at, u.fname AS reporter_fname, u.lname AS reporter_lname
      FROM public."REPORT" r
      LEFT JOIN public."USER" u ON r.reporter_id = u.user_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
    `);

    // Log the action of viewing reports
    await logUserAction(req.user.id, 'view_reports', 'Moderator viewed pending reports');

    res.status(200).json(result.rows); // Return all pending reports
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

/**
 * @swagger
 * /moderate-report:
 *   post:
 *     summary: Moderate a reported document
 *     description: Allows admins and moderators to approve or reject a reported document.
 *     tags:
 *       - Reporting
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               report_id:
 *                 type: integer
 *                 description: The ID of the report to be moderated.
 *               action:
 *                 type: string
 *                 description: The action to be taken, either 'resolved' or 'rejected'.
 *             example:
 *               report_id: 123
 *               action: "resolved"
 *     responses:
 *       200:
 *         description: Report has been moderated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   description: A message confirming the moderation action.
 *                 report:
 *                   type: object
 *                   description: The moderated report.
 *                   properties:
 *                     report_id:
 *                       type: integer
 *                       description: The ID of the report.
 *                     file_id:
 *                       type: integer
 *                       description: The ID of the reported document.
 *                     status:
 *                       type: string
 *                       description: The updated status of the report.
 *                     reason:
 *                       type: string
 *                       description: The reason for the report.
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: The time the report was created.
 *       400:
 *         description: Invalid action. Use 'resolved' or 'rejected'.
 *       403:
 *         description: Access denied. Only admins and moderators can moderate reports.
 *       404:
 *         description: Report not found.
 *       500:
 *         description: Server error.
 */


// Moderate a report (approve or reject) route
app.post('/moderate-report', authorize, async (req, res) => {
  const { report_id, action } = req.body;

  // Ensure only valid actions are taken
  if (!['resolved', 'rejected'].includes(action)) {
    return res.status(400).json({ msg: "Invalid action. Use 'resolved' or 'rejected'." });
  }

  try {
    // Check if the user has the correct role
    const allowedRoles = ['admin', 'moderator'];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Only admins and Moderators can view reports.' });
 }

    // Update the status of the report
    const result = await pool.query(`
      UPDATE public."REPORT"
      SET status = $1
      WHERE report_id = $2
      RETURNING *
    `, [action, report_id]);

    // Check if the report was found
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Report not found." });
    }

    // Log the moderation action
    await logUserAction(req.user.id, 'moderate_report', `Moderator ${action} report with ID: ${report_id}`);

    res.status(200).json({ msg: `Report has been ${action}.`, report: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});


/**
 * @swagger
 * /activity-logs:
 *   get:
 *     summary: Get all activity logs
 *     description: Retrieve all activity logs in the system. Only accessible to admins and moderators.
 *     tags:
 *       - Activity Logs
 *     security:
 *       - jwt_token: []
 *     responses:
 *       200:
 *         description: A list of activity logs.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   log_id:
 *                     type: integer
 *                     description: The unique ID of the activity log.
 *                   user_id:
 *                     type: integer
 *                     description: The ID of the user who performed the action.
 *                   activity_type:
 *                     type: string
 *                     description: The type of activity performed (e.g., login, document upload).
 *                   description:
 *                     type: string
 *                     description: Additional information about the activity.
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                     description: The time the activity occurred.
 *       403:
 *         description: Access denied. Only admins and moderators can view activity logs.
 *       500:
 *         description: Server error.
 */


// Get all activity logs (only for admins and moderators) route
app.get('/activity-logs', authorize, async (req, res) => {
  try {
    // Check if the logged-in user is an admin or moderator
    const allowedRoles = ['admin', 'moderator'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ msg: "Access denied. Only admins and moderators can view activity logs." });
    }

    // Fetch all activity logs
    const result = await pool.query(`SELECT * FROM public."ACTIVITY_LOG" ORDER BY timestamp DESC`);

    // Return all activity logs
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

/**
 * @swagger
 * /analytics:
 *   get:
 *     summary: Get all user analytics
 *     description: Retrieve all user analytics data in the system. Only accessible to admins and moderators.
 *     tags:
 *       - User Analytics
 *     security:
 *       - jwt_token: []
 *     responses:
 *       200:
 *         description: A list of user analytics.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   analytics_id:
 *                     type: integer
 *                     description: The unique ID of the analytics record.
 *                   user_id:
 *                     type: integer
 *                     description: The ID of the user whose activity is tracked.
 *                   page_visited:
 *                     type: string
 *                     description: The page visited by the user.
 *                   time_spent:
 *                     type: string
 *                     description: The duration the user spent on the page.
 *                   visit_date:
 *                     type: string
 *                     format: date-time
 *                     description: The date and time of the visit.
 *       403:
 *         description: Access denied. Only admins and moderators can view user analytics.
 *       500:
 *         description: Server error.
 */


// Get all user analytics (only for admins and moderators) route
app.get('/analytics', authorize, async (req, res) => {
  try {
    // Check if the logged-in user is an admin or moderator
    const allowedRoles = ['admin', 'moderator'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ msg: "Access denied. Only admins and moderators can view user analytics." });
    }

    // Fetch all user analytics
    const result = await pool.query(`SELECT * FROM public."ANALYTICS" ORDER BY visit_date DESC`);

    // Return all user analytics
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

/**
 * @swagger
 * /faq:
 *   post:
 *     summary: Add a new FAQ
 *     description: Allows admins or moderators to create a new FAQ entry in the system.
 *     tags:
 *       - FAQs
 *     security:
 *       - jwt_token: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question:
 *                 type: string
 *                 description: The question for the FAQ.
 *             required:
 *               - question
 *     responses:
 *       200:
 *         description: FAQ created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   description: Success message.
 *                 faq:
 *                   type: object
 *                   properties:
 *                     faq_id:
 *                       type: integer
 *                       description: The unique ID of the FAQ.
 *                     question:
 *                       type: string
 *                       description: The question in the FAQ.
 *                     created_by:
 *                       type: integer
 *                       description: ID of the user who created the FAQ.
 *       400:
 *         description: Missing or invalid question.
 *       403:
 *         description: Access denied. Only admins or moderators can create FAQs.
 *       500:
 *         description: Server error.
 */


// Add a FAQ route 
 
app.post("/faq", authorize, async (req, res) => {
  const { question } = req.body;

  // Check if the user is an admin or moderator
  const allowedRoles = ['admin', 'moderator'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ msg: "Access denied. Only admins or moderators can create FAQs." });
  }

  if (!question) {
    return res.status(400).json({ msg: "Please provide a question" });
  }

  try {
    // Insert the FAQ with the user_id of the admin or moderator who created it
    const result = await pool.query(
      'INSERT INTO public."FAQ" (question, created_by) VALUES ($1, $2) RETURNING *',
      [question, req.user.id]
    );

    // Log the user action for creating an FAQ
    await logUserAction(req.user.id, 'create_faq', `Created FAQ with ID: ${result.rows[0].faq_id}`);

    // Return success response
    res.status(200).json({ msg: "FAQ created successfully", faq: result.rows[0] });

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

/**
 * @swagger
 * /faq_answer:
 *   post:
 *     summary: Add an answer to a FAQ
 *     description: Allows admins or moderators to provide an answer for a specific FAQ entry.
 *     tags:
 *       - FAQs
 *     security:
 *       - jwt_token: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               faq_id:
 *                 type: integer
 *                 description: The ID of the FAQ to which the answer is being added.
 *               answer:
 *                 type: string
 *                 description: The answer text for the FAQ.
 *             required:
 *               - faq_id
 *               - answer
 *     responses:
 *       200:
 *         description: Answer added successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   description: Success message.
 *       400:
 *         description: Missing FAQ ID or answer.
 *       403:
 *         description: Permission denied. Only admins or moderators can add answers to FAQs.
 *       500:
 *         description: Server error.
 */


//FAQ answer route

app.post("/faq_answer", authorize, async (req, res) => {
  const { faq_id, answer } = req.body;

  // Check if the user is an Admin or Moderator
  const userRole = await pool.query('SELECT role FROM public.\"USER\" WHERE user_id = $1', [req.user.id]);
  if (!['admin', 'moderator'].includes(userRole.rows[0].role)) {
    return res.status(403).json({ msg: "Permission denied" });
  }

  // Ensure FAQ ID and answer are provided
  if (!faq_id || !answer) {
    return res.status(400).json({ msg: "Please provide both FAQ ID and answer" });
  }

  try {
    // Update the FAQ with the provided answer
    await pool.query(
      "UPDATE public.\"FAQ\" SET answer = $1 WHERE faq_id = $2",
      [answer, faq_id]
    );

    // Log the user action for adding an answer
    await logUserAction(req.user.id, 'answer_faq', `Answered FAQ with ID: ${faq_id}`);

    // Send success response
    res.status(200).json({ msg: "Answer added successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});


/**
 * @swagger
 * /faqs:
 *   get:
 *     summary: Retrieve all FAQs
 *     description: Fetches a list of all frequently asked questions (FAQs) sorted by creation date.
 *     tags:
 *       - FAQs
 *     responses:
 *       200:
 *         description: A list of FAQs successfully retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   faq_id:
 *                     type: integer
 *                     description: Unique identifier for the FAQ.
 *                   question:
 *                     type: string
 *                     description: The FAQ question.
 *                   answer:
 *                     type: string
 *                     description: The answer to the FAQ.
 *                   created_by:
 *                     type: integer
 *                     description: ID of the user who created the FAQ.
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     description: Timestamp of when the FAQ was created.
 *       500:
 *         description: Server error.
 */


//Route to view FAQs

app.get("/faqs", async (req, res) => {
  try {
    const faqs = await pool.query("SELECT * FROM public.\"FAQ\" ORDER BY created_at DESC");
    
    // Send the FAQs response
    res.status(200).json(faqs.rows);

    // Log the page visit for FAQs
    let user_id = null;

    // Check if the request contains a valid token for a logged-in user
    const token = req.header("jwt_token");
    if (token) {
      try {
        const verify = jwt.verify(token, process.env.jwtSecret);
        user_id = verify.user.id;
      } catch (err) {
        console.error("Invalid token, logging page visit for open access user");
      }
    }

    // Log the visit, use 'FAQs Page' as page name
    await logPageVisit(user_id, "FAQs Page", null);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

/**
 * @swagger
 * /convert-to-pdf/{file_id}:
 *   get:
 *     summary: Convert a file to PDF
 *     description: Converts a specified file to PDF format if it's not already in PDF format. If the file is already a PDF, it returns an error.
 *     tags:
 *       - File Conversion
 *     parameters:
 *       - name: file_id
 *         in: path
 *         required: true
 *         description: The unique identifier of the file to be converted.
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: The file was successfully converted to PDF and saved.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   description: Confirmation message about the successful conversion.
 *                 pdfUrl:
 *                   type: string
 *                   description: URL of the newly converted PDF file.
 *       400:
 *         description: The file is already in PDF format or missing parameters.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   description: Error message detailing the issue.
 *       404:
 *         description: The specified file was not found in the database.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   description: Error message indicating the file was not found.
 *       500:
 *         description: Server error occurred during the conversion process.
 */


// Route to convert a file to PDF (if it's not already PDF)
app.get('/convert-to-pdf/:file_id', async (req, res) => {
  try {
    const { file_id } = req.params;

    // Fetch the file details from the database
    const fileResult = await pool.query('SELECT * FROM public."FILE" WHERE file_id = $1', [file_id]);
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ msg: "File not found" });
    }

    const fileData = fileResult.rows[0];
    const filePath = fileData.storage_path; // Assuming storage_path holds the actual file URL or path

    // Check if the file is already a PDF
    const fileExtension = path.extname(filePath).toLowerCase();
    if (fileExtension === '.pdf') {
      return res.status(400).json({ msg: "File is already in PDF format" });
    }

    // Fetch the file from SeaweedFS
    const response = await axios.get(filePath, { responseType: 'arraybuffer' });
    const inputFile = Buffer.from(response.data); // The file content

    // Convert to PDF
    libre.convert(inputFile, '.pdf', undefined, async (err, done) => {
      if (err) {
        console.log(`Error converting file: ${err.message}`);
        return res.status(500).json({ msg: "Error converting file" });
      }

      // Step 1: Send the converted PDF to SeaweedFS
      const formData = new FormData();
      const bufferStream = new stream.PassThrough();
      bufferStream.end(done); // Use the converted PDF buffer

      formData.append('file', bufferStream, {
        filename: `${path.basename(fileData.file_name, fileExtension)}.pdf`,
        contentType: 'application/pdf'
      });

      // Upload the PDF to SeaweedFS
      const seaweedResponse = await axios.post('http://localhost:9333/submit', formData, {
        headers: formData.getHeaders()
      });

      // Get the SeaweedFS file URL
      let pdfStoragePath = seaweedResponse.data.fileUrl;
      if (!pdfStoragePath.startsWith('http')) {
        pdfStoragePath = `http://${pdfStoragePath}`;
      }

      // Step 2: Update the database with the new PDF file path
      await pool.query(
        'UPDATE public."FILE" SET storage_path = $1 WHERE file_id = $2',
        [pdfStoragePath, file_id]
      );

      // Step 3: Return the PDF link or allow download
      res.status(200).json({
        msg: "File converted and saved successfully",
        pdfUrl: pdfStoragePath  // Return the new PDF file URL for download
      });
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});



// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(3000, () => {
    console.log("Server is running on port 3000");
  });
}

module.exports = {
  jwtGenerator, authorize
  
};

module.exports = app;


