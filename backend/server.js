//----20 Sep -------------------------------
const axios = require('axios'); // Import axios
const FormData = require('form-data'); // Import FormData to handle multipart data
const fs = require('fs');
//------------------------------------------


//-----23 Sep-----------------------------
const stream = require('stream');

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const { Document, Packer, Paragraph, Footer, AlignmentType, TextRun } = require('docx');

const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

//-------------------------------------------



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

//-----------24 Sep Kenewang------
const session = require("express-session");
//---------------------

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

// Function to log user navigation (page visit) [24 Sep Kenewang]
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




//-------------------------22 Sep ----------------------------


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




//---------------------------------------------------------------




// Route to fetch active (logged-in) user info [Kenewang 24 Sep]
app.post("/active_user", authorize, async (req, res) => {
  try {
    const user = await pool.query("SELECT Fname, Lname FROM public.\"USER\" WHERE user_id = $1", [req.user.id]);
    res.json(user.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});



// ------------Develop basic CRUD operations for documents.[Kenewang]-------------


 


// Get all documents

// Document list route for both logged-in and anonymous users
app.get('/documents', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM public."FILE"`);
    res.status(200).json(result.rows);

    // Determine if the user is logged in or not
    let user_id = null;  // Default to null for anonymous users

    // If JWT is provided, extract the user info (this requires middleware to decode JWT)
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1]; // Assuming 'Bearer <token>'
        const decoded = jwt.verify(token, process.env.jwtSecret);
        user_id = decoded.user.id; // Use logged-in user's ID
      } catch (err) {
        console.error("JWT error: ", err.message);
      }
    }

    // Log the page visit for "Documents List"
    await logPageVisit(user_id, "Documents List", null); // Time spent is null for now; will be calculated from the front-end

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





// Update a document  [modified on 24 Sep by Kenewang]
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


// Delete a document  modified by kenewang on 23 Sep
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


//----------------------------------------------
// Security middleware
app.use(helmet());
app.use(morgan('combined'));



//----------23 Sep----------------------------------------------




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








//--------------------------------------------------------------------------------




//-----21 Sep Document Creationg and upload to Seaweedfs ----------------
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

// Upload file to SeaweedFS, handle keywords, and create a document

// Upload file to SeaweedFS, handle keywords, and create a document

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

    // Add watermark or license to the file (e.g., PDF or DOCX)
    if (req.file.mimetype === 'application/pdf') {
      req.file.buffer = await addWatermarkToPDF(req.file.buffer);
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      req.file.buffer = await addWatermarkToDocx(req.file.buffer);
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


    // Log the file upload action [Kenewang 24 Sep]
    await logUserAction(req.user.id, "file_upload", `Uploaded file: ${req.body.file_name}`);

    res.status(201).json({ msg: "File uploaded, document created, and keywords linked successfully", file: fileResult.rows[0] });



  } catch (err) {
    console.error('Caught error:', err);
    res.status(500).send({ message: err.message || err });
  }
});



//--------------------------------------------------------------------------


//------------------21 Sep [Searching Modified by Kenewang]--------------------------------------------
// Search documents by file_name, subject, grade, rating, uploaded_by, status, and keywords
// Function to log user navigation (page visit)


// Document search route for both logged-in and anonymous users [24 Sep Kenewang]
app.get('/search-documents', async (req, res) => {
  const { file_name, subject, grade, rating, uploaded_by, status, keywords } = req.query;

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
    
    if (subject) {
      query += ` AND f.subject = $${valueIndex++}`;
      values.push(subject);
    }

    if (grade) {
      query += ` AND f.grade = $${valueIndex++}`;
      values.push(grade);
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
      values.push(keywordList.map(kw => `%${kw}%`)); // Search for any keyword
    }

    // Execute the query
    const result = await pool.query(query, values);

    // Check if the user is logged in or not
    let user_id = null;  // Default to null for anonymous users

    // If JWT is provided, extract the user info (this requires middleware to decode JWT)
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1]; // Assuming 'Bearer <token>'
        const decoded = jwt.verify(token, process.env.jwtSecret);
        user_id = decoded.user.id; // Use logged-in user's ID
      } catch (err) {
        console.error("JWT error: ", err.message);
      }
    }

    // Log the search action (with user_id being either null for anonymous or the actual user ID)
    await logPageVisit(user_id, 'Document Search', null);

    // Return the filtered documents
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





//---------------------------------------------------------------------------






//----[kenewang] Implement moderation features for approving or rejecting documents -----
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



// Rating submission route  [Kenewang (original)]
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




//---document reporting [aadil] modified by [kenewang] 22 Sep ---------------------------------

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



// Get all pending reports (for moderators)
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




// Moderate a report (approve or reject)
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




//----------------------------------------------------------------------------



// Start server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
