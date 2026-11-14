import assert from 'node:assert/strict';
import { PhotoRecord } from '../contracts';
import {
  clampAdminSensitivityPct,
  filterPhotosByDay,
  formatThaiDayLabel,
  getBangkokHourMinute,
  summarizeHourlyStats,
  toBangkokDateKey,
} from './dayStats';

function mkPhoto(code: string, iso: string): PhotoRecord {
  return {
    code,
    photoUrl: `/api/photos/${code}/file`,
    qrUrl: `/p/${code}`,
    createdAt: iso,
    expiresAt: '2026-11-22T00:00:00.000Z',
  };
}

function testBangkokMidnightRolloverAndTimezoneAccuracy() {
  // 23:59:59 Bangkok on 14 Nov = 16:59:59Z
  assert.equal(toBangkokDateKey('2026-11-14T16:59:59.000Z'), '2026-11-14');
  // 00:00:00 Bangkok on 15 Nov = 17:00:00Z
  assert.equal(toBangkokDateKey('2026-11-14T17:00:00.000Z'), '2026-11-15');

  const hm = getBangkokHourMinute('2026-11-14T04:15:00.000Z'); // 11:15 Bangkok
  assert.deepEqual(hm, { hour: 11, minute: 15 });

  assert.equal(formatThaiDayLabel('2026-11-14').includes('14'), true);
}

function testMultiDayIsolationAndPdpaDeletion() {
  const photos = [
    mkPhoto('OPH-D101', '2026-11-14T02:30:00.000Z'), // Day 1 09:30 BKK
    mkPhoto('OPH-D102', '2026-11-14T04:10:00.000Z'), // Day 1 11:10 BKK
    mkPhoto('OPH-D103', '2026-11-14T04:20:00.000Z'), // Day 1 11:20 BKK (deleted)
    mkPhoto('OPH-D201', '2026-11-15T03:00:00.000Z'), // Day 2 10:00 BKK
  ];
  const deleted = ['OPH-D103'];

  const day1 = filterPhotosByDay(photos, deleted, '2026-11-14', '2026-11-15');
  assert.deepEqual(day1.map((p) => p.code), ['OPH-D101', 'OPH-D102']);

  const autoToday = filterPhotosByDay(photos, deleted, 'TODAY', '2026-11-15');
  assert.deepEqual(autoToday.map((p) => p.code), ['OPH-D201']);

  const allDays = filterPhotosByDay(photos, deleted, 'ALL', '2026-11-15');
  assert.deepEqual(allDays.map((p) => p.code), ['OPH-D101', 'OPH-D102', 'OPH-D201']);

  // Midnight auto-switch at 00:00 of Day 2 without changing user selection TODAY
  assert.equal(filterPhotosByDay(photos, deleted, 'TODAY', '2026-11-14').length, 2);
  assert.equal(filterPhotosByDay(photos, deleted, 'TODAY', '2026-11-15').length, 1);
}

function testHourlyStatsAndSensitivityClamp() {
  const day1Photos = [
    mkPhoto('OPH-A1', '2026-11-14T02:10:00.000Z'), // 09:xx
    mkPhoto('OPH-A2', '2026-11-14T04:05:00.000Z'), // 11:xx
    mkPhoto('OPH-A3', '2026-11-14T04:45:00.000Z'), // 11:xx
  ];
  const stats = summarizeHourlyStats(day1Photos);
  assert.equal(stats.avgPerHour, 2); // 3 photos / 2 active hours -> round(1.5)=2
  assert.equal(stats.peakLabel, 'พีค 11:00');
  assert.equal(stats.peakRange, '11:00 - 12:00');

  assert.deepEqual(summarizeHourlyStats([]), { avgPerHour: 0, peakLabel: '--:--', peakRange: '--:--' });

  assert.equal(clampAdminSensitivityPct(1.5), 2.5);
  assert.equal(clampAdminSensitivityPct(2.5), 2.5);
  assert.equal(clampAdminSensitivityPct(4.2), 4.2);
  assert.equal(clampAdminSensitivityPct(9.0), 5.5);
  assert.equal(clampAdminSensitivityPct(Number.NaN), 2.5);
}

testBangkokMidnightRolloverAndTimezoneAccuracy();
testMultiDayIsolationAndPdpaDeletion();
testHourlyStatsAndSensitivityClamp();

console.log('dayStats: all 3 test suites passed');
