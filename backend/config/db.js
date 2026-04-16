const mongoose = require('mongoose');

const MONGO_CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 10000,
  connectTimeoutMS: 10000,
};

// Avoid queuing model operations when there is no active Mongo connection.
mongoose.set('bufferCommands', false);

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is missing. Add it to backend/.env before starting the server.');
  }

  const uriScheme = mongoUri.startsWith('mongodb+srv://') ? 'mongodb+srv' : 'mongodb';
  console.log(`ℹ️  MongoDB URI scheme: ${uriScheme}`);

  try {
    const conn = await mongoose.connect(mongoUri, MONGO_CONNECT_OPTIONS);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error(`❌ MongoDB connection error: ${err.message}`);
    throw err;
  }
};

module.exports = connectDB;
