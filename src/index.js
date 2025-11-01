import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Routes
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import userRoutes from './routes/users.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',') 
  : ['http://localhost:8080', 'http://localhost:5173'];

app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Request size limits to prevent DoS attacks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);

// Basic error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Ensure default admin exists
    (async function ensureDefaultAdmin() {
      try {
        const User = (await import('./models/User.js')).default;
        const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@123.com';
        const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin@123';
        const existing = await User.findOne({ email });
        if (!existing) {
          const hashed = await bcrypt.hash(password, 10);
          const admin = new User({ email, password: hashed, role: 'admin' });
          await admin.save();
          console.log(`Default admin created: ${email}`);
        } else if (existing.role !== 'admin') {
          existing.role = 'admin';
          await existing.save();
          console.log(`Existing user ${email} promoted to admin`);
        } else {
          console.log(`Default admin ${email} already exists`);
        }
      } catch (err) {
        console.error('Error ensuring default admin:', err);
      }
    })();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });