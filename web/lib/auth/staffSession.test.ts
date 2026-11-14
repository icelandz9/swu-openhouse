import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { isStaffRequest, STAFF_COOKIE } from './staffSession';

function fakeReq(host: string, cookieToken?: string): NextRequest {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'host' ? host : null),
    },
    cookies: {
      get: (name: string) => (name === STAFF_COOKIE && cookieToken ? { value: cookieToken } : undefined),
    },
  } as unknown as NextRequest;
}

function testHostBypassPrevention() {
  assert.equal(isStaffRequest(fakeReq('localhost:3000')), true);
  assert.equal(isStaffRequest(fakeReq('127.0.0.1:3000')), true);
  assert.equal(isStaffRequest(fakeReq('localhost')), true);
  assert.equal(isStaffRequest(fakeReq('127.0.0.1')), true);

  // Security critical: prefix-matching subdomains or attacker IPs MUST NOT pass without cookie
  assert.equal(
    isStaffRequest(fakeReq('localhost.evil.com')),
    false,
    'Subdomain localhost.evil.com must NOT bypass staff auth'
  );
  assert.equal(
    isStaffRequest(fakeReq('127.0.0.1.nip.io')),
    false,
    'Domain 127.0.0.1.nip.io must NOT bypass staff auth'
  );
  assert.equal(isStaffRequest(fakeReq('booth.cpe-swu.com')), false);
}

testHostBypassPrevention();
console.log('staffSession: all host-security assertions passed');
