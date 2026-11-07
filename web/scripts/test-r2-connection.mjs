import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Load .env.local manually if not in Next environment
const envPath = path.resolve(process.cwd(), 'web', '.env.local');
const altEnvPath = path.resolve(process.cwd(), '.env.local');
const targetEnv = fs.existsSync(envPath) ? envPath : (fs.existsSync(altEnvPath) ? altEnvPath : null);

if (targetEnv) {
  const envContent = fs.readFileSync(targetEnv, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
  console.log(`Loaded environment from: ${targetEnv}`);
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  return crypto.createHmac('sha256', kService).update('aws4_request').digest();
}

async function runR2Test() {
  console.log('\n======================================================');
  console.log('🧪 TESTING CLOUDFLARE R2 S3-COMPATIBLE CONNECTION');
  console.log('======================================================\n');

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'swu-photobooth';
  const publicDomain = (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/+$/, '');

  console.log(`- Account ID:        ${accountId ? '✓ Configured (' + accountId.slice(0, 8) + '...)' : '❌ MISSING'}`);
  console.log(`- Access Key ID:     ${accessKeyId ? '✓ Configured (' + accessKeyId.slice(0, 8) + '...)' : '❌ MISSING'}`);
  console.log(`- Secret Access Key: ${secretAccessKey ? '✓ Configured (Secret Hidden)' : '❌ MISSING'}`);
  console.log(`- Bucket Name:       ${bucketName}`);
  console.log(`- Public Domain:     ${publicDomain || '⚠️ Not configured (Direct R2 dev URL recommended)'}\n`);

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.log('⚠️ Status: Cloudflare R2 credentials not fully set.');
    console.log('💡 Note: The app will safely fall back to Local Storage (data/photos/).');
    console.log('👉 To connect R2, please add the 3 credentials into web/.env.local and re-run.\n');
    return;
  }

  // 1. Create a dummy test image
  const testKey = `test-connection-${Date.now()}.jpg`;
  const dummyBuffer = Buffer.from('TEST_CLOUDFLARE_R2_PAYLOAD_SWU_OPENHOUSE_2026');

  try {
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const path = `/${bucketName}/${testKey}`;
    const endpoint = `https://${host}${path}`;

    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const payloadHash = crypto.createHash('sha256').update(dummyBuffer).digest('hex');

    const canonicalHeaders = `content-type:image/jpeg\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = `PUT\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto
      .createHash('sha256')
      .update(canonicalRequest)
      .digest('hex')}`;

    const signingKey = getSignatureKey(secretAccessKey, dateStamp, 'auto', 's3');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    console.log(`▶ Uploading test file: ${testKey} ...`);
    const uploadRes = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
        Host: host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authHeader,
      },
      body: new Uint8Array(dummyBuffer),
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error(`❌ Upload failed with status ${uploadRes.status}: ${errText}`);
      return;
    }

    console.log(`✓ Upload successful! (HTTP ${uploadRes.status})`);

    // 2. Check public URL accessibility
    if (publicDomain) {
      const publicUrl = `${publicDomain}/${testKey}`;
      console.log(`▶ Testing public access URL: ${publicUrl} ...`);
      try {
        const pubRes = await fetch(publicUrl, { method: 'GET' });
        if (pubRes.ok) {
          console.log(`✓ Public download verified! Status ${pubRes.status}`);
        } else {
          console.log(`⚠️ Public URL returned ${pubRes.status}. Check if Public Access / Custom Domain is enabled in R2 Settings.`);
        }
      } catch (e) {
        console.log(`⚠️ Could not reach public domain: ${e.message}`);
      }
    }

    console.log('\n🎉 CLOUDFLARE R2 IS FULLY OPERATIONAL AND READY FOR ONSITE EVENT!');
  } catch (error) {
    console.error('❌ Connection test error:', error);
  }
}

runR2Test();
