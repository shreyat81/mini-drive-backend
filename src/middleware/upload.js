import multer from 'multer';
import { GridFsStorage } from 'multer-gridfs-storage';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Create storage engine
const storage = new GridFsStorage({
  url: process.env.MONGODB_URI,
  options: { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
  },
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});

// Initialize multer with storage engine
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/png", "image/jpeg", "application/pdf"];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Invalid file type. Only PNG, JPEG, and PDF files are allowed.');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }
    cb(null, true);
  }
});

export default upload;