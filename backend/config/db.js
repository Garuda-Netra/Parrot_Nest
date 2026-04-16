const mongoose = require('mongoose');
const dns = require('node:dns/promises');

const MONGO_CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 10000,
  connectTimeoutMS: 10000,
};

// Avoid queuing model operations when there is no active Mongo connection.
mongoose.set('bufferCommands', false);

function isSrvDnsError(err) {
  if (!err) {
    return false;
  }

  const message = String(err.message || '');
  const code = String(err.code || '');

  return (
    message.includes('querySrv ECONNREFUSED') ||
    message.includes('querySrv ENOTFOUND') ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND'
  );
}

function parseAtlasTxtOptions(txtRecords) {
  const params = new URLSearchParams();

  for (const record of txtRecords || []) {
    const joined = Array.isArray(record) ? record.join('') : String(record || '');
    if (!joined) {
      continue;
    }

    const recordParams = new URLSearchParams(joined);
    for (const [key, value] of recordParams.entries()) {
      if (!params.has(key)) {
        params.set(key, value);
      }
    }
  }

  return params;
}

async function resolveSrvViaDnsOverHttps(srvRecord) {
  const encodedName = encodeURIComponent(srvRecord);
  const response = await fetch(`https://dns.google/resolve?name=${encodedName}&type=SRV`);

  if (!response.ok) {
    throw new Error(`DoH SRV lookup failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const answers = Array.isArray(payload.Answer) ? payload.Answer : [];
  const records = [];

  for (const answer of answers) {
    if (answer.type !== 33 || typeof answer.data !== 'string') {
      continue;
    }

    const parts = answer.data.trim().split(/\s+/);
    if (parts.length < 4) {
      continue;
    }

    const port = Number.parseInt(parts[2], 10);
    const host = parts.slice(3).join(' ').replace(/\.$/, '');

    if (!host || !Number.isFinite(port)) {
      continue;
    }

    records.push({ name: host, port });
  }

  if (records.length === 0) {
    throw new Error('No SRV records returned from DoH resolver.');
  }

  return records;
}

async function resolveTxtViaDnsOverHttps(baseHost) {
  const encodedName = encodeURIComponent(baseHost);
  const response = await fetch(`https://dns.google/resolve?name=${encodedName}&type=TXT`);

  if (!response.ok) {
    throw new Error(`DoH TXT lookup failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const answers = Array.isArray(payload.Answer) ? payload.Answer : [];

  return answers
    .filter((answer) => answer.type === 16 && typeof answer.data === 'string')
    .map((answer) => answer.data.replace(/^"|"$/g, ''));
}

async function buildStandardUriFromSrv(srvUri) {
  const parsed = new URL(srvUri);
  const baseHost = parsed.hostname;
  const srvRecord = `_mongodb._tcp.${baseHost}`;

  let srvResults = [];
  let txtResults = [];

  try {
    srvResults = await dns.resolveSrv(srvRecord);
  } catch {
    srvResults = await resolveSrvViaDnsOverHttps(srvRecord);
  }

  try {
    txtResults = await dns.resolveTxt(baseHost);
  } catch {
    txtResults = await resolveTxtViaDnsOverHttps(baseHost);
  }

  if (!Array.isArray(srvResults) || srvResults.length === 0) {
    throw new Error('Unable to resolve SRV records for Atlas cluster.');
  }

  const hosts = srvResults
    .map((entry) => `${entry.name.replace(/\.$/, '')}:${entry.port}`)
    .join(',');

  const mergedParams = new URLSearchParams(parsed.search);
  const atlasTxtParams = parseAtlasTxtOptions(txtResults);

  for (const [key, value] of atlasTxtParams.entries()) {
    if (!mergedParams.has(key)) {
      mergedParams.set(key, value);
    }
  }

  if (!mergedParams.has('tls')) {
    mergedParams.set('tls', 'true');
  }

  const dbPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/';
  const auth = parsed.username
    ? `${encodeURIComponent(decodeURIComponent(parsed.username))}:${encodeURIComponent(decodeURIComponent(parsed.password || ''))}@`
    : '';

  return `mongodb://${auth}${hosts}${dbPath}?${mergedParams.toString()}`;
}

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
    if (mongoUri.startsWith('mongodb+srv://') && isSrvDnsError(err)) {
      console.warn('⚠️  SRV lookup failed. Trying Atlas fallback with standard mongodb:// hosts...');

      try {
        const fallbackUri = await buildStandardUriFromSrv(mongoUri);
        const conn = await mongoose.connect(fallbackUri, MONGO_CONNECT_OPTIONS);
        console.log(`✅ MongoDB connected via fallback: ${conn.connection.host}`);
        return conn;
      } catch (fallbackErr) {
        console.error(`❌ MongoDB fallback connection error: ${fallbackErr.message}`);
        throw fallbackErr;
      }
    }

    console.error(`❌ MongoDB connection error: ${err.message}`);
    throw err;
  }
};

module.exports = connectDB;
