import express from "express";
import mongoose from "mongoose";
import "dotenv/config";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import jwt from "jsonwebtoken";
import cors from "cors";
import admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

//import schemas
import User from "./models/User.js";
import Blog from "./models/Blog.js";
import Notification from "./models/Notification.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true // Added for better cross-origin handling
  })
);

const port = process.env.PORT;
const SALT_ROUNDS = 10;

//Google sign-up initialization
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/;

app.use(express.json());

//DataBase connection
mongoose
  .connect(process.env.MONGO_URI, {
    autoIndex: true,
  })
  .then(async () => {
    console.log("Connected to database");
    try {
      const result = await User.updateMany({}, { $set: { blog_Banner: {} } });
      console.log(`Updated ${result.modifiedCount} documents`);
    } catch (error) {
      console.error("Error updating schema:", error);
    }
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });

// FIXED: Improved uploads directory creation with better error handling
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
    console.log(`Created uploads directory at ${uploadsDir}`);
  } catch (error) {
    console.error(`Error creating uploads directory: ${error.message}`);
  }
}

// FIXED: Added file type validation to multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir); // Use absolute path instead of relative
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// FIXED: Added file filter to ensure only valid image types are accepted
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};

// FIXED: Added file filter and size limits to multer
const upload = multer({ 
  storage: storage, 
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

async function generateUsername(email) {
  let username = email.split("@")[0];
  let isUserNameNotUnique = await User.exists({
    "personal_info.username": username,
  }).then((result) => result);

  isUserNameNotUnique ? (username += nanoid().substring(0, 4)) : "";

  return username;
}

function formataSendData(user) {
  const access_token = jwt.sign(
    { id: user._id },
    process.env.SECRET_ACCESS_KEY
  );

  return {
    access_token,
    profile_img: user.personal_info.profile_img,
    username: user.personal_info.username,
    fullname: user.personal_info.fullname,
  };
}

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(403).json({ error: "No token provided" });
  }

  jwt.verify(token, process.env.SECRET_ACCESS_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.userId = decoded.id;
    next();
  });
};

//sign-up route
app.post("/signup", async (req, res) => {
  let { fullname, email, password } = req.body;

  if (fullname.length < 3) {
    return res
      .status(403)
      .json({ error: "full name should be more that 3 letters" });
  }

  if (!email.length) {
    return res.status(403).json({ error: "Enter email" });
  }

  if (!emailRegex.test(email)) {
    return res.status(403).json({ error: "Enter a valid email" });
  }

  if (!passwordRegex.test(password)) {
    return res.status(403).json({
      error:
        "Password should be 6-20 characters long, include at least one uppercase letter, one lowercase letter, and one numeric digit",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    let username = await generateUsername(email);

    let user = new User({
      personal_info: { fullname, email, password: hashedPassword, username },
    });

    user
      .save()
      .then((u) => {
        console.log(formataSendData(u));
        return res.status(200).json(formataSendData(u));
      })
      .catch((error) => {
        if (error.code == 11000) {
          return res.status(500).json({ error: " Email already exists " });
        }

        return res.status(500).json({ error: error.message });
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//sign-in route
app.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ "personal_info.email": email });

    if (!user) {
      return res.status(403).json({ error: "Email not found" });
    }

    if (!user.google_auth) {
      const isMatch = await bcrypt.compare(
        password,
        user.personal_info.password
      );

      if (!isMatch) {
        return res.status(403).json({ error: "Invalid password" });
      } else {
        return res.status(200).json(formataSendData(user));
      }
    } else {
      return res.status(403).json({
        error:
          "Account was already created using google. Try logging in with google",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//google-auth route
app.post("/google-auth", async (req, res) => {
  let { access_token } = req.body;

  if (!access_token) {
    return res.status(400).json({ error: "Access token is required" });
  }

  getAuth()
    .verifyIdToken(access_token)
    .then(async (decodeduser) => {
      let { email, name } = decodeduser;

      let user = await User.findOne({ "personal_info.email": email })
        .select(
          "personal_info.fullname personal_info.username personal_info.profile_img google_auth"
        )
        .then((u) => u)
        .catch((err) => {
          return res.status(500).json({ error: err.message });
        });

      if (user) {
        // Login
        if (!user.google_auth) {
          return res.status(403).json({
            error:
              "This Email is already signed up without Google. Please login with password.",
          });
        }
      } else {
        // Signup
        let username = await generateUsername(email);

        user = new User({
          personal_info: {
            fullname: name,
            email,
            username,
          },
          google_auth: true,
        });

        await user
          .save()
          .then((u) => {
            user = u;
          })
          .catch((err) => {
            return res.status(500).json({ error: err.message });
          });
      }
      return res.status(200).json(formataSendData(user));
    })
    .catch((err) => {
      console.error("Error verifying Google token:", err);
      return res.status(500).json({
        error:
          "Failed to authenticate with Google, try with another Google account",
      });
    });
});

// FIXED: Fixed port and improved error handling in upload-banner route
app.post(
  "/upload-banner",
  verifyToken,
  upload.single("banner"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    // FIXED: Using environment port variable instead of hardcoded 3005
    const banner_url = `http://localhost:${port}/uploads/${req.file.filename}`;
    console.log(`Generated banner URL: ${banner_url}`);

    try {
      await User.findByIdAndUpdate(req.userId, {
        "blog_Banner.banner_image": banner_url,
      });

      res.json({ banner_url });
    } catch (error) {
      console.error(`Error saving banner: ${error.message}`);
      res.status(500).json({ error: "Error saving banner" });
    }
  }
);

// FIXED: Fixed port in upload-profile-image route
app.post(
  "/upload-profile-image",
  verifyToken,
  upload.single("profile_img"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // FIXED: Using environment port variable instead of hardcoded 3005
    const profile_img_url = `http://localhost:${port}/uploads/${req.file.filename}`;
    console.log(`Generated profile image URL: ${profile_img_url}`);

    try {
      // Update the user's profile image in the database
      await User.findByIdAndUpdate(req.userId, {
        "personal_info.profile_img": profile_img_url,
      }).then(() => {
        return res.status(200).json({ profile_img: profile_img_url });
      });
    } catch (error) {
      console.error(`Error saving profile image: ${error.message}`);
      return res.status(500).json({ error: "Error saving profile image" });
    }
  }
);

// FIXED: Improved static file serving configuration with absolute path
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ADDED: Debug route to check uploads directory and files
app.get("/debug-images", (req, res) => {
  try {
    const uploadsPath = path.join(process.cwd(), "uploads");
    const files = fs.existsSync(uploadsPath) ? 
      fs.readdirSync(uploadsPath) : [];
    
    res.json({
      uploadsExists: fs.existsSync(uploadsPath),
      uploadsPath,
      files,
      serverUrl: `http://localhost:${port}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/change-password", verifyToken, (req, res) => {
  let { currentPassword, newPassword } = req.body;
  if (
    !passwordRegex.test(newPassword) ||
    !passwordRegex.test(currentPassword)
  ) {
    return res.status(400).json({
      error:
        "Password should be 6-20 characters long, include at least one uppercase letter, one lowercase letter, and one numeric digit",
    });
  }

  User.findOne({ _id: req.userId })
    .then((user) => {
      if (user.google_auth) {
        return res.status(400).json({
          error: "You cannot change password for google authenticated account",
        });
      }

      bcrypt.compare(
        currentPassword,
        user.personal_info.password,
        (err, result) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          if (!result) {
            return res
              .status(400)
              .json({ error: "Current password is incorrect" });
          }
          bcrypt.hash(newPassword, SALT_ROUNDS, (err, hashed_Password) => {
            User.findOneAndUpdate(
              { _id: req.userId },
              { "personal_info.password": hashed_Password }
            )
              .then((u) => {
                return res
                  .status(200)
                  .json({ message: "Password changed successfully" });
              })
              .catch((err) => {
                return res.status(500).json({ error: err.message });
              });
          });
        }
      );
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: "user not found" });
    });
});

//finding latest-blogs
app.post("/latest-blogs", (req, res) => {
  let { page } = req.body;
  let maxLimit = 5;
  Blog.find({ draft: false })
    .populate(
      "author",
      "personal_info.profile_img personal_info.username personal_info.fullname -_id"
    )
    .sort({ publishedAt: -1 })
    .select("blog_id title des banner activity tags publishedAt -_id")
    .skip((page - 1) * maxLimit)
    .limit(maxLimit)
    .then((blogs) => {
      return res.status(200).json({ blogs });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

//latest-blogs-countRoute
app.post("/all-latest-blogs-count", (req, res) => {
  Blog.countDocuments({ draft: false })
    .then((count) => {
      return res.status(200).json({ totalDocs: count });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

//search-blogs-countRoute
app.post("/search-blogs-count", (req, res) => {
  let { author, query, tag } = req.body;
  let findQuery = { draft: false }; // Base query to exclude drafts

  // Add conditions to the query object as needed
  if (tag) {
    findQuery.tags = tag;
  }

  if (query) {
    findQuery.title = new RegExp(query, "i");
  }

  if (author) {
    findQuery.author = author;
  }

  Blog.countDocuments(findQuery)
    .then((count) => {
      return res.status(200).json({ totalDocs: count });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

//setting up trending-blogs
app.get("/trending-blogs", (req, res) => {
  Blog.find({ draft: false })
    .populate(
      "author",
      "personal_info.profile_img personal_info.username personal_info.fullname -_id"
    )
    .sort({
      "activity.total_reads": -1,
      "activity.total_likes": -1,
      publishedAt: -1,
    })
    .select("blog_id title publishedAt -_id")
    .limit(5)
    .then((blogs) => {
      return res.status(200).json({ blogs });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

//Filtreing
app.post("/search-blogs", (req, res) => {
  let { query, tag, page, limit, eliminate_blog, author } = req.body;
  let findQuery = { draft: false }; // Base query to exclude drafts

  // Build the query based on parameters
  if (tag) {
    findQuery.tags = tag;
  }

  if (query) {
    findQuery.title = new RegExp(query, "i");
  }

  if (eliminate_blog) {
    findQuery.blog_id = { $ne: eliminate_blog };
  }

  if (author) {
    findQuery.author = author; // Add author to query when provided
  }

  let maxLimit = limit || 2;

  Blog.find(findQuery)
    .populate(
      "author",
      "personal_info.profile_img personal_info.username personal_info.fullname -_id"
    )
    .sort({ publishedAt: -1 })
    .select("blog_id title des banner activity tags publishedAt -_id")
    .skip((page - 1) * maxLimit)
    .limit(maxLimit)
    .then((blogs) => {
      return res.status(200).json({ blogs });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

//searching users in url
app.post("/search-users", (req, res) => {
  let { query } = req.body;

  User.find({ "personal_info.username": new RegExp(query, "i") })
    .limit(50)
    .select(
      "personal_info.profile_img personal_info.username personal_info.fullname -_id"
    )
    .then((users) => {
      return res.status(200).json({ users });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

//to get User profile
app.post("/get-profile", (req, res) => {
  let { username } = req.body;
  User.findOne({ "personal_info.username": username })
    .select("-personal_info.password -google_auth -updatedAt -blogs")
    .then((user) => {
      return res.status(200).json(user);
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

//update profile
app.post("/update-profile", verifyToken, (req, res) => {
  let { username, bio, social_links } = req.body;
  let bioLimit = 150;

  if (username.length < 3) {
    return res
      .status(403)
      .json({ error: "username must be atleast 3 characters long" });
  }
  if (bio.length > bioLimit) {
    return res
      .status(403)
      .json({ error: `Bio should not be more than ${bioLimit} characters` });
  }

  let socialLinksArr = Object.keys(social_links);
  try{
    for(let i =0;i<socialLinksArr.length;i++){
      if(social_links[socialLinksArr[i]].length){
        let hostname = new URL(social_links[socialLinksArr[i]]).hostname;

        if(!hostname.includes(`${socialLinksArr[i]}.com`)&& socialLinksArr[i] != "website"){
          return res.status(403).json({error: `${socialLinksArr[i]} link is not valid`});
        }
      }
    }
  }catch(err){
    return res.status(500).json({error: "You must provide full social links with http(s) included"});
  }

  let UpdateObj = {
    "personal_info.username": username,
    "personal_info.bio": bio,
    social_links
  }
  
  User.findByIdAndUpdate({_id :req.userId}, UpdateObj,{
    runValidators: true,
  }).then(()=>{
    return res.status(200).json({username});
  }).catch(err=>{
    if(err.code == 11000){
      return res.status(403).json({error: "Username already exists"});
    }
    return res.status(500).json({error: err.message});
  })
});

//Publish to create a blog
app.post("/create-blog", verifyToken, (req, res) => {
  let authorId = req.userId;
  let { title, des, banner, content, tags, draft, id } = req.body;

  if (!title) {
    return res.status(403).json({ error: "You must provide a title." });
  }

  if (!draft) {
    if (!des.length || des.length > 200) {
      return res.status(403).json({
        error: "You must provide the description with in 200 characters.",
      });
    }
    if (!banner.length) {
      return res.status(403).json({
        error: "You must upload the banner image to publish the blog.",
      });
    }
    if (!content.blocks.length) {
      return res
        .status(403)
        .json({ error: "There must be some blog content to publish it." });
    }
    if (!tags.length || tags.length > 10) {
      return res.status(403).json({
        error:
          "Provide the tags in order to publish the blog, maximum limit 10.",
      });
    }
  }

  tags = tags.map((tag) => tag.toLowerCase());
  let blog_id =
    id ||
    title
      .replace(/[^a-zA-Z0-9]/g, "")
      .replace(/\s+/g, "-")
      .trim() + nanoid();

  if (id) {
    Blog.findOneAndUpdate(
      { blog_id },
      { title, des, banner, content, tags, draft: draft ? draft : false }
    )
      .then((blog) => {
        return res.status(200).json({ id: blog_id });
      })
      .catch((err) => {
        return res.status(500).json({ error: err.message });
      });
  } else {
    let blog = new Blog({
      title,
      banner,
      des,
      content,
      tags,
      author: authorId,
      blog_id,
      draft: Boolean(draft),
    });

    blog
      .save()
      .then((blog) => {
        let incrementvalue = draft ? 0 : 1;
        User.findOneAndUpdate(
          { _id: authorId },
          {
            $inc: { "account_info.total_posts": incrementvalue },
            $push: { blogs: blog._id },
          }
        )
          .then((user) => {
            return res.status(200).json({ id: blog_id });
          })
          .catch((err) => {
            return res
              .status(500)
              .json({ error: "Failed to update total posts number" });
          });
      })
      .catch((error) => {
        return res.status(500).json({ error: error.message });
      });
  }
});

app.post("/get-blog", (req, res) => {
  let { blog_id, draft, mode } = req.body;
  let incrementvalue = mode != "edit" ? 1 : 0;
  Blog.findOneAndUpdate(
    { blog_id },
    { $inc: { "activity.total_reads": incrementvalue } }
  )
    .populate(
      "author",
      "personal_info.username personal_info.profile_img personal_info.fullname"
    )
    .select("title des content banner activity publishedAt blog_id tags")
    .then((blog) => {
      User.findOneAndUpdate(
        { "personal_info.username": blog.author.personal_info.username },
        { $inc: { "account_info.total_reads": incrementvalue } }
      ).catch((err) => {
        console.error("Error updating total reads:", err);
      });

      if (blog.draft && !draft) {
        return res
          .status(500)
          .json({ error: "You cannot access the draft blog" });
      }

      return res.status(200).json({ blog });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

app.post("/like-blog", verifyToken, (req, res) => {
  let user_id = req.userId;
  let { _id, islikedByUser } = req.body;
  let incrementvalue = !islikedByUser ? 1 : -1;

  Blog.findOneAndUpdate(
    { _id },
    { $inc: { "activity.total_likes": incrementvalue } }
  ).then((blog) => {
    if (!islikedByUser) {
      let like = new Notification({
        type: "like",
        blog: _id,
        notification_for: blog.author,
        user: user_id,
      });

      like.save().then((notification) => {
        res.status(200).json({ liked_by_user: true });
      });
    } else {
      Notification.findOneAndDelete({ user: user_id, type: "like", blog: _id })
        .then((data) => {
          return res.status(200).json({ liked_by_user: false });
        })
        .catch((err) => {
          return res.status(500).json({ error: err.message });
        });
    }
  });
});

app.post("/isliked-by-user", verifyToken, (req, res) => {
  let user_id = req.userId;

  let { _id } = req.body;

  Notification.exists({ user: user_id, type: "like", blog: _id })
    .then((result) => {
      return res.status(200).json({ result });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

// ADDED: New endpoint to get the current user's profile
app.get("/get-current-user", verifyToken, (req, res) => {
  User.findById(req.userId)
    .select("-personal_info.password -google_auth -updatedAt")
    .then((user) => {
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.status(200).json({ user });
    })
    .catch((err) => {
      console.error("Error fetching current user:", err);
      return res.status(500).json({ error: "Internal server error" });
    });
});

// ADDED: Endpoint to verify token and get basic user info for auth status
app.get("/auth-status", verifyToken, (req, res) => {
  User.findById(req.userId)
    .select("personal_info.username personal_info.fullname personal_info.profile_img")
    .then(user => {
      if(!user) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.status(200).json({
        isAuthenticated: true,
        username: user.personal_info.username,
        profile_img: user.personal_info.profile_img,
        fullname: user.personal_info.fullname
      });
    })
    .catch(err => {
      console.error("Auth status error:", err);
      return res.status(500).json({ error: "Failed to verify authentication" });
    });
});

// ADDED: Get user account details for settings page
app.get("/user-settings", verifyToken, (req, res) => {
  User.findById(req.userId)
    .select("-personal_info.password -google_auth -blogs")
    .then(user => {
      if(!user) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.status(200).json({ user });
    })
    .catch(err => {
      console.error("Settings fetch error:", err);
      return res.status(500).json({ error: "Failed to fetch user settings" });
    });
});

// ADDED: Get user's blogs (including drafts for the authenticated user)
app.get("/user-blogs", verifyToken, (req, res) => {
  let user_id = req.userId;
  
  Blog.find({ author: user_id })
    .populate("author", "personal_info.profile_img personal_info.username personal_info.fullname")
    .sort({ publishedAt: -1 })
    .select("blog_id title des banner activity tags publishedAt draft")
    .then((blogs) => {
      return res.status(200).json({ blogs });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.message });
    });
});

// ADDED: Get user profile details and blogs for profile page
app.get("/user-profile", verifyToken, (req, res) => {
  const userId = req.userId;
  
  // Get user details first
  User.findById(userId)
    .select("personal_info.username personal_info.fullname personal_info.profile_img personal_info.bio social_links account_info joinedAt")
    .then(user => {
      if(!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Then get their blogs
      Blog.find({ author: userId, draft: false })
        .select("blog_id title des banner activity tags publishedAt")
        .sort({ publishedAt: -1 })
        .then(blogs => {
          return res.status(200).json({ 
            user,
            blogs
          });
        });
    })
    .catch(err => {
      console.error("Profile fetch error:", err);
      return res.status(500).json({ error: "Failed to fetch user profile" });
    });
});

app.listen(port, () => {
  console.log(`server is listening on port ${port} `);
});