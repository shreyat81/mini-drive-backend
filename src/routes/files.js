import express from 'express';
import mongoose from 'mongoose';
import { verifyToken, isAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import File from '../models/File.js';
import AccessRequest from '../models/AccessRequest.js';
import User from '../models/User.js';
import fileController from '../controllers/fileController.js';

const router = express.Router();
let bucket;

mongoose.connection.once('open', () => {
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

// Upload handler (extracted so we can reuse for '/' and '/upload')
const uploadHandler = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = new File({
      filename: req.file.filename,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
      size: req.file.size,
      owner: req.user.id
    });

    await file.save();
    res.status(201).json({ message: 'File uploaded successfully', file });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading file', error: error.message });
  }
};

// Upload file (legacy path: POST /api/files/upload)
router.post('/upload', verifyToken, upload.single('file'), uploadHandler);

// Alias: accept POST /api/files as upload as well (form-data field 'file')
router.post('/', verifyToken, upload.single('file'), uploadHandler);

// Get user's files
router.get('/my-files', verifyToken, fileController.getMyFiles);

// Get all files (admin only)
router.get('/all', verifyToken, isAdmin, fileController.getAllFiles);

// Download file
router.get('/download/:id', verifyToken, fileController.downloadFile);

// Delete file
router.delete('/:id', verifyToken, fileController.deleteFile);

// Update file metadata (owner or admin can update; admin can transfer ownership)
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const { originalName, contentType, ownerId } = req.body;
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Only owner or admin can update metadata
    if (!file.owner.equals(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update allowed fields
    if (originalName) file.originalName = originalName;
    if (contentType) file.contentType = contentType;

    // Only admin can transfer ownership
    if (ownerId) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admin can transfer ownership' });
      }

      const newOwner = await User.findById(ownerId);
      if (!newOwner) return res.status(404).json({ message: 'New owner not found' });
      file.owner = newOwner._id;
    }

    await file.save();

    const populated = await File.findById(file._id).populate('owner', 'email');
    res.json({ message: 'File metadata updated', file: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating file', error: error.message });
  }
});

// Share file
router.post('/:id/share', verifyToken, async (req, res) => {
  try {
    const { userId, permission } = req.body;
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (!file.owner.equals(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add or update sharing permission
    const shareIndex = file.sharedWith.findIndex(share => share.user.equals(userId));
    if (shareIndex > -1) {
      file.sharedWith[shareIndex].permission = permission;
    } else {
      file.sharedWith.push({ user: userId, permission });
    }

    await file.save();
    res.json({ message: 'File shared successfully', file });
  } catch (error) {
    res.status(500).json({ message: 'Error sharing file', error: error.message });
  }
});

// Generate a shareable link (owner only)
router.post('/:id/generate-link', verifyToken, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });
  if (!file.owner.equals(req.user.id)) return res.status(403).json({ message: 'Access denied' });

    // create a random token
    const crypto = await import('crypto');
    const token = crypto.randomBytes(12).toString('hex');
    file.shareToken = token;
    await file.save();

    const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:8081';
    const link = `${frontendBase}/shared/${token}`;
    res.json({ link, token });
  } catch (error) {
    res.status(500).json({ message: 'Error generating link', error: error.message });
  }
});

// Public endpoint to get file metadata by share token (no auth)
router.get('/public/:token', async (req, res) => {
  try {
    const file = await File.findOne({ shareToken: req.params.token }).populate('owner', 'email');
    if (!file) return res.status(404).json({ message: 'File not found' });

    res.json({
      _id: file._id,
      originalName: file.originalName,
      size: file.size,
      uploadDate: file.uploadDate,
      owner: file.owner ? { _id: file.owner._id, email: file.owner.email } : null
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching public file', error: error.message });
  }
});

// Request access to a file (other users)
router.post('/:id/request-access', verifyToken, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    // If user already has access or is owner
    if (file.owner.equals(req.user.id) || file.sharedWith.some(s => s.user.equals(req.user.id))) {
      return res.status(400).json({ message: 'You already have access to this file' });
    }

    // Create access request
  const existing = await AccessRequest.findOne({ file: file._id, requestedBy: req.user.id, status: 'pending' });
    if (existing) return res.status(400).json({ message: 'Access request already pending' });
  const accessRequest = new AccessRequest({ file: file._id, requestedBy: req.user.id });
    await accessRequest.save();
    res.status(201).json({ message: 'Access request submitted' });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting access', error: error.message });
  }
});

// Get pending access requests for files owned by the current user
router.get('/access-requests', verifyToken, async (req, res) => {
  try {
    const requests = await AccessRequest.find({ status: 'pending' })
      .populate('file')
      .populate('requestedBy', 'email');

    // Filter to only requests where the file owner is the current user
  const userRequests = requests.filter(r => r.file.owner.equals(req.user.id));
    res.json(userRequests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching access requests', error: error.message });
  }
});

// Approve access request (owner approves)
router.post('/access-requests/:requestId/approve', verifyToken, async (req, res) => {
  try {
    const { permission } = req.body;
    const request = await AccessRequest.findById(req.params.requestId).populate('file');
    if (!request) return res.status(404).json({ message: 'Access request not found' });

  if (!request.file.owner.equals(req.user.id)) return res.status(403).json({ message: 'Access denied' });

    // Add to file sharedWith
    await File.findByIdAndUpdate(request.file._id, {
      $push: { sharedWith: { user: request.requestedBy, permission: permission || 'view' } }
    });

    request.status = 'approved';
    request.permission = permission || 'view';
    await request.save();

    res.json({ message: 'Access granted' });
  } catch (error) {
    res.status(500).json({ message: 'Error approving access', error: error.message });
  }
});

// ensure access requests are removed when a file is deleted
// (we already delete file metadata in the delete handler above)
router.delete('/:id/cleanup-access-requests', verifyToken, isAdmin, async (req, res) => {
  try {
    await AccessRequest.deleteMany({ file: req.params.id });
    res.json({ message: 'Access requests cleaned up' });
  } catch (error) {
    res.status(500).json({ message: 'Error cleaning up access requests', error: error.message });
  }
});

export default router;