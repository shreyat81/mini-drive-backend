import express from 'express';
import { verifyToken, isAdmin } from '../middleware/auth.js';
import User from '../models/User.js';
import File from '../models/File.js';

const router = express.Router();

// Find user by email
router.post('/find', verifyToken, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ userId: user._id });
  } catch (error) {
    res.status(500).json({ message: 'Error finding user', error: error.message });
  }
});

// Promote a user to admin — only accessible by existing admins (uses JWT auth)
// POST /api/users/:id/promote
router.post('/:id/promote', verifyToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.role = 'admin';
    await user.save();
    res.json({ message: 'User promoted to admin', user: { id: user._id, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: 'Error promoting user', error: error.message });
  }
});

// List all users (admin only)
// GET /api/users
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'email role createdAt').sort({ createdAt: -1 });
    console.log(`GET /api/users - returning ${users.length} users`);
    // optional debugging of emails (sanitized)
    console.log(users.map(u => ({ email: u.email, role: u.role })));
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Error listing users', error: error.message });
  }
});

// Get files for a specific user (admin only)
// GET /api/users/:id/files
router.get('/:id/files', verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const files = await File.find({ owner: userId }).populate('owner', 'email');
    console.log(`GET /api/users/${userId}/files - returning ${files.length} files`);
    res.json({ files });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user files', error: error.message });
  }
});

export default router;