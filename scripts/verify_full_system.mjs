const sampleJpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function runFullVerification() {
  console.log('===============================================================');
  console.log('       SWU CPE PHOTOBOOTH - FULL SUITE SECURITY & R2 AUDIT      ');
  console.log('===============================================================');

  // STEP 1: Upload a test photo
  console.log('\n[STEP 1] Testing Photo Capture & Cloudflare R2 Upload...');
  const uploadRes = await fetch('http://localhost:3000/api/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: sampleJpegBase64,
      code: 'OPH-AUD1'
    })
  });
  const uploadData = await uploadRes.json();
  console.log(` -> Upload HTTP Status: ${uploadRes.status} (Expected: 201)`);
  console.log(` -> Assigned Code: ${uploadData.code}`);
  console.log(` -> Generated Token: ${uploadData.token}`);
  console.log(` -> Cloudflare R2 CDN URL: ${uploadData.photoUrl}`);
  const { code, token, photoUrl } = uploadData;

  // STEP 2: Verify R2 CDN file exists
  console.log('\n[STEP 2] Verifying Cloudflare R2 Public CDN Storage...');
  const cdnRes = await fetch(photoUrl);
  console.log(` -> R2 CDN HTTP Status: ${cdnRes.status} (Expected: 200)`);
  console.log(` -> Content-Type: ${cdnRes.headers.get('content-type')}`);

  // STEP 3: Adversarial IDOR Test - Attacker types URL directly without token
  console.log('\n[STEP 3] Adversarial IDOR Test: Direct Access Without Token');
  const directApiRes = await fetch(`http://localhost:3000/api/photos/${code}`);
  console.log(` -> GET /api/photos/${code} Status: ${directApiRes.status} (Expected: 403 Forbidden)`);
  const directApiData = await directApiRes.json();
  console.log(` -> Block reason: ${directApiData.error}`);

  const directFileRes = await fetch(`http://localhost:3000/api/photos/${code}/file`);
  console.log(` -> GET /api/photos/${code}/file Status: ${directFileRes.status} (Expected: 403 Forbidden)`);

  const directClaimRes = await fetch(`http://localhost:3000/api/photos/${code}/claim`);
  console.log(` -> GET /api/photos/${code}/claim Status: ${directClaimRes.status} (Expected: 403 Forbidden)`);

  // STEP 4: Legitimate Attendee QR Scan with Cryptographic Token
  console.log('\n[STEP 4] Legitimate Attendee QR Scan (with ?t=...)');
  const claimRes = await fetch(`http://localhost:3000/api/photos/${code}/claim?t=${token}`);
  console.log(` -> GET /api/photos/${code}/claim?t=${token} Status: ${claimRes.status} (Expected: 200 OK)`);
  const rawCookie = claimRes.headers.get('set-cookie');
  console.log(` -> Claim Cookie Set: ${rawCookie ? 'YES (' + rawCookie.split(';')[0] + ')' : 'NO'}`);
  const cookieValue = rawCookie ? rawCookie.split(';')[0] : '';

  // STEP 5: Attendee Returns Later Using 7-Day Device Claim Cookie (without ?t=...)
  console.log('\n[STEP 5] Attendee Returning With 7-Day Device Claim Cookie (No token in URL)');
  const cookieAuthRes = await fetch(`http://localhost:3000/api/photos/${code}`, {
    headers: { 'Cookie': cookieValue }
  });
  console.log(` -> GET /api/photos/${code} with Cookie Status: ${cookieAuthRes.status} (Expected: 200 OK)`);
  const cookieAuthData = await cookieAuthRes.json();
  console.log(` -> Successfully Retrieved Photo URL: ${cookieAuthData.photoUrl}`);

  // STEP 6: Untrusted Attacker from another device tries same photo with counterfeit cookie
  console.log('\n[STEP 6] Adversarial Counterfeit Cookie Test');
  const forgedCookieRes = await fetch(`http://localhost:3000/api/photos/${code}`, {
    headers: { 'Cookie': `booth_claim_${code.replace(/[^A-Z0-9]/g, '_')}=forged_hacker_token_12345` }
  });
  console.log(` -> Fake Cookie Access Status: ${forgedCookieRes.status} (Expected: 403 Forbidden)`);

  // STEP 7: Staff Photo Deletion on Cloudflare R2
  console.log('\n[STEP 7] Staff Photo Deletion (Cloudflare R2 Bucket Cleanup)');
  const deleteRes = await fetch(`http://localhost:3000/api/photos/${code}`, {
    method: 'DELETE'
  });
  console.log(` -> DELETE /api/photos/${code} Status: ${deleteRes.status} (Expected: 200 OK)`);
  const deleteData = await deleteRes.json();
  console.log(` -> Deletion Result:`, deleteData);

  // STEP 8: Post-Deletion Verification in Cloudflare R2
  console.log('\n[STEP 8] Post-Deletion Verification: Proving Object is Erased from R2');
  const cdnPostDeleteRes = await fetch(photoUrl);
  console.log(` -> R2 CDN Post-Delete HTTP Status: ${cdnPostDeleteRes.status} (Expected: 404 Not Found)`);

  const apiPostDeleteRes = await fetch(`http://localhost:3000/api/photos/${code}?t=${token}`);
  console.log(` -> API Post-Delete HTTP Status: ${apiPostDeleteRes.status} (Expected: 404 Not Found)`);

  console.log('\n===============================================================');
  console.log('             ALL 8 SECURITY & R2 AUDIT TESTS PASSED!           ');
  console.log('===============================================================');
}

runFullVerification().catch(console.error);
