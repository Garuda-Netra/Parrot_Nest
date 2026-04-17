const mongoose = require('mongoose');

const clipSchema = new mongoose.Schema({
  content: {
    type: String,
    default: null,
    maxlength: 1_000_000, // 1 MB limit
    validate: {
      validator: function(v) {
        return !v || v.trim().length > 0; // Allow null or non-empty string
      },
      message: 'Content cannot be empty.',
    },
  },
  files: [
    {
      fileName: String,
      fileUrl: String,
      fileSize: Number,
    }
  ],
  code: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  deleteTokenHash: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },  // TTL index — MongoDB auto-deletes when Date passes
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Clip', clipSchema);
