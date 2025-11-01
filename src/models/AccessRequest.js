import mongoose from 'mongoose';

const accessRequestSchema = new mongoose.Schema({
  file: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  permission: {
    type: String,
    enum: ['view', 'edit'],
    default: 'view'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'accessrequests' // Explicitly set collection name
});

export default mongoose.model('AccessRequest', accessRequestSchema);