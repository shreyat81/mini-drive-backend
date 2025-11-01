import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import File from './src/models/File.js';

dotenv.config();

async function checkDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const users = await User.find({}).select('email role createdAt');
    console.log(`📊 Total users in database: ${users.length}`);
    console.log('Users:');
    users.forEach(u => {
      console.log(`  - ${u.email} (${u.role}) - created: ${u.createdAt.toLocaleDateString()}`);
    });

    console.log('\n');

    const files = await File.find({}).populate('owner', 'email').limit(10);
    console.log(`📁 Total files in database: ${await File.countDocuments()}`);
    if (files.length > 0) {
      console.log('Sample files:');
      files.forEach(f => {
        console.log(`  - ${f.originalName} (${f.size} bytes) - owner: ${f.owner?.email || 'unknown'}`);
      });
    } else {
      console.log('No files found in database.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkDB();
