const path = require('path');
const fs = require('fs/promises');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Clip = require('../models/Clip');
const Url = require('../models/Url');

function parseArgs(argv) {
  const flags = new Set(argv.slice(2));
  return {
    confirm: flags.has('--confirm'),
    dryRun: flags.has('--dry-run'),
  };
}

function isCleanupEnabled() {
  const raw = (process.env.CLEANUP_ENABLED || '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function getUploadsDir() {
  return path.join(__dirname, '..', 'uploads');
}

function sanitizeFileName(fileUrl) {
  if (typeof fileUrl !== 'string' || !fileUrl.trim()) {
    return '';
  }

  let decoded = fileUrl.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    decoded = fileUrl.trim();
  }

  const safeName = path.basename(decoded);
  if (!safeName || safeName === '.' || safeName === '..') {
    return '';
  }

  return safeName;
}

async function safeUnlink(filePath, counters) {
  try {
    await fs.unlink(filePath);
    counters.deletedFiles += 1;
    return;
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      counters.missingFiles += 1;
      return;
    }

    counters.fileDeleteErrors += 1;
    console.warn(`WARN file delete failed: ${filePath} -> ${err.message}`);
  }
}

async function cleanupClipFiles(files, uploadsDir, counters, dryRun) {
  for (const file of files || []) {
    const fileName = sanitizeFileName(file && file.fileUrl);
    if (!fileName) {
      continue;
    }

    const filePath = path.join(uploadsDir, fileName);
    if (dryRun) {
      counters.wouldDeleteFiles += 1;
      continue;
    }

    await safeUnlink(filePath, counters);
  }
}

async function cleanupOrphanedUploads(uploadsDir, counters, dryRun) {
  const names = await fs.readdir(uploadsDir);
  for (const name of names) {
    if (name === '.gitkeep') {
      continue;
    }

    const fullPath = path.join(uploadsDir, name);
    const stat = await fs.stat(fullPath);

    if (!stat.isFile()) {
      continue;
    }

    if (dryRun) {
      counters.wouldDeleteFiles += 1;
      continue;
    }

    await safeUnlink(fullPath, counters);
  }
}

async function run() {
  const { confirm, dryRun } = parseArgs(process.argv);

  if (!isCleanupEnabled()) {
    throw new Error('Cleanup is disabled. Set CLEANUP_ENABLED=true in backend/.env to continue.');
  }

  if (!dryRun && !confirm) {
    throw new Error('Refusing to run destructive cleanup without --confirm. Use --dry-run to preview.');
  }

  const uploadsDir = getUploadsDir();
  await fs.access(uploadsDir);

  await connectDB();

  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database is not ready. Cleanup aborted.');
  }

  const counters = {
    clipsScanned: 0,
    clipsDeleted: 0,
    urlsDeleted: 0,
    deletedFiles: 0,
    wouldDeleteFiles: 0,
    missingFiles: 0,
    fileDeleteErrors: 0,
  };

  const clipsBefore = await Clip.countDocuments();
  const urlsBefore = await Url.countDocuments();

  console.log(`Starting cleanup mode=${dryRun ? 'dry-run' : 'confirm'} clips=${clipsBefore} urls=${urlsBefore}`);

  const clips = await Clip.find({}, { files: 1 }).lean();
  counters.clipsScanned = clips.length;

  for (const clip of clips) {
    await cleanupClipFiles(clip.files, uploadsDir, counters, dryRun);
  }

  if (!dryRun) {
    const clipDeleteResult = await Clip.deleteMany({});
    counters.clipsDeleted = clipDeleteResult.deletedCount || 0;

    const urlDeleteResult = await Url.deleteMany({});
    counters.urlsDeleted = urlDeleteResult.deletedCount || 0;
  } else {
    counters.clipsDeleted = clipsBefore;
    counters.urlsDeleted = urlsBefore;
  }

  await cleanupOrphanedUploads(uploadsDir, counters, dryRun);

  const clipsAfter = dryRun ? clipsBefore : await Clip.countDocuments();
  const urlsAfter = dryRun ? urlsBefore : await Url.countDocuments();

  const remainingUploadEntries = (await fs.readdir(uploadsDir)).filter((name) => name !== '.gitkeep');

  const summary = {
    mode: dryRun ? 'dry-run' : 'confirm',
    clipsBefore,
    urlsBefore,
    clipsAfter,
    urlsAfter,
    clipsScanned: counters.clipsScanned,
    clipsDeleted: counters.clipsDeleted,
    urlsDeleted: counters.urlsDeleted,
    deletedFiles: counters.deletedFiles,
    wouldDeleteFiles: counters.wouldDeleteFiles,
    missingFiles: counters.missingFiles,
    fileDeleteErrors: counters.fileDeleteErrors,
    remainingUploadEntries,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!dryRun) {
    const hasResidualData = clipsAfter > 0 || urlsAfter > 0 || remainingUploadEntries.length > 0;
    if (hasResidualData || counters.fileDeleteErrors > 0) {
      process.exitCode = 1;
    }
  }
}

run()
  .catch((err) => {
    console.error(`Cleanup failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });