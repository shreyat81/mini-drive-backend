import mongoose from 'mongoose';
import File from '../models/File.js';
import AccessRequest from '../models/AccessRequest.js';

const getBucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

export const getMyFiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const owned = await File.find({ owner: userId }).populate('owner', 'email');
    const sharedRaw = await File.find({ 'sharedWith.user': userId }).populate('owner', 'email');

    const shared = sharedRaw.map(f => {
      const share = f.sharedWith.find(s => s.user.equals(userId));
      const obj = f.toObject();
      obj.userPermission = share ? share.permission : null;
      return obj;
    });

    res.json({ owned, shared });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching files', error: error.message });
  }
};

export const getAllFiles = async (req, res) => {
  try {
    const files = await File.find().populate('owner', 'email');
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching files', error: error.message });
  }
};

export const downloadFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    // Allow owner, shared user, or admin
    const userId = req.user.id;
    const isOwner = file.owner.toString() === userId;
    const isShared = file.sharedWith.some(s => s.user.equals(userId));
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isShared && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const bucket = getBucket();
    const downloadStream = bucket.openDownloadStreamByName(file.filename);
    res.set('Content-Type', file.contentType);
    res.set('Content-Disposition', `attachment; filename="${file.originalName}"`);
    downloadStream.pipe(res);
  } catch (error) {
    res.status(500).json({ message: 'Error downloading file', error: error.message });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    const userId = req.user.id;
    const isOwner = file.owner.toString() === userId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete from GridFS
    const bucket = getBucket();
    const files = await bucket.find({ filename: file.filename }).toArray();
    if (files.length > 0) {
      await bucket.delete(files[0]._id);
    }

    await File.findByIdAndDelete(req.params.id);
    await AccessRequest.deleteMany({ file: req.params.id });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting file', error: error.message });
  }
};

export default {
  getMyFiles,
  getAllFiles,
  downloadFile,
  deleteFile,
};
