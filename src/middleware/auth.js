import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// verifyToken: validates JWT and attaches decoded user info to req.user
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded should contain { id, role }
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    // Attach minimal user info to request
    req.user = { id: user._id.toString(), role: user.role, email: user.email };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// isAdmin: checks req.user.role === 'admin'
export const isAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};