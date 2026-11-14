import assert from 'node:assert/strict';
import { generatePhotoToken, verifyPhotoToken, isHostAllowed } from './photoToken';
import { generateShortCode, isValidShortCode } from '../mobile/shortCodeGenerator';

function testShortCodeFormat() {
  for (let i = 0; i < 100; i++) {
    const code = generateShortCode();
    assert.equal(isValidShortCode(code), true, `Generated invalid code: ${code}`);
    assert.ok(!/[01ILO]/.test(code.slice(4)), `Ambiguous character leaked in code: ${code}`);
  }
  assert.equal(isValidShortCode('OPH-../X'), false);
  assert.equal(isValidShortCode(''), false);
}

function testTokenGenerationAndTamperResistance() {
  const { token, expiresAtSec } = generatePhotoToken('OPH-AB29', 600, 'test-secret-123');
  assert.ok(expiresAtSec > Math.floor(Date.now() / 1000));
  assert.equal(verifyPhotoToken('OPH-AB29', token, 'test-secret-123'), true);
  assert.equal(verifyPhotoToken('oph-ab29', token, 'test-secret-123'), true);

  // Tamper / wrong code / wrong secret / expired token must fail
  assert.equal(verifyPhotoToken('OPH-CD34', token, 'test-secret-123'), false, 'Token from AB29 must not authorize CD34');
  assert.equal(verifyPhotoToken('OPH-AB29', token, 'wrong-secret'), false);
  assert.equal(verifyPhotoToken('OPH-AB29', token.slice(0, -2) + '00', 'test-secret-123'), false);
  assert.equal(verifyPhotoToken('OPH-AB29', '', 'test-secret-123'), false);

  const expired = generatePhotoToken('OPH-AB29', -10, 'test-secret-123');
  assert.equal(verifyPhotoToken('OPH-AB29', expired.token, 'test-secret-123'), false);
}

function testHostAllowlistRejectsPhishingDomains() {
  assert.equal(isHostAllowed('localhost:3000'), true);
  assert.equal(isHostAllowed('192.168.1.50:3000'), true);
  assert.equal(isHostAllowed('https://booth.cpe-swu.com'), true);
  assert.equal(isHostAllowed('https://my-app.vercel.app'), true);
  assert.equal(isHostAllowed('https://evil-phishing.example.com'), false);
  assert.equal(isHostAllowed('http://169.254.169.254'), false);
}

testShortCodeFormat();
testTokenGenerationAndTamperResistance();
testHostAllowlistRejectsPhishingDomains();

console.log('photoToken & shortCodeGenerator: all 3 test suites passed');
