import { PhotoRecord } from '../contracts';

export const MIN_ADMIN_SENSITIVITY_PCT = 2.5;
export const MAX_ADMIN_SENSITIVITY_PCT = 5.5;

export function clampAdminSensitivityPct(pct: number): number {
  if (!Number.isFinite(pct)) return MIN_ADMIN_SENSITIVITY_PCT;
  return Math.max(MIN_ADMIN_SENSITIVITY_PCT, Math.min(MAX_ADMIN_SENSITIVITY_PCT, pct));
}

export function toBangkokDateKey(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

export function getBangkokHourMinute(input: Date | string): { hour: number; minute: number } | null {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 'NaN');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 'NaN');
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

export function formatThaiDayLabel(dateKey: string): string {
  if (!dateKey) return '';
  const d = new Date(`${dateKey}T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString('th-TH-u-ca-gregory', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
  });
}

export function filterPhotosByDay(
  photos: PhotoRecord[],
  deletedCodes: string[],
  dayFilter: 'TODAY' | 'ALL' | string,
  todayKey: string
): PhotoRecord[] {
  const effectiveDateKey = dayFilter === 'TODAY' ? todayKey : dayFilter === 'ALL' ? null : dayFilter;
  return photos.filter((photo) => {
    if (deletedCodes.includes(photo.code)) return false;
    if (effectiveDateKey && toBangkokDateKey(photo.createdAt) !== effectiveDateKey) return false;
    return true;
  });
}

export function summarizeHourlyStats(dayPhotos: PhotoRecord[]): {
  avgPerHour: number;
  peakLabel: string;
  peakRange: string;
} {
  if (dayPhotos.length === 0) {
    return { avgPerHour: 0, peakLabel: '--:--', peakRange: '--:--' };
  }
  const hourBuckets = new Map<number, number>();
  for (const p of dayPhotos) {
    const hm = getBangkokHourMinute(p.createdAt);
    if (hm) hourBuckets.set(hm.hour, (hourBuckets.get(hm.hour) || 0) + 1);
  }
  let bestHour = -1;
  let bestCount = 0;
  hourBuckets.forEach((count, hour) => {
    if (count > bestCount) {
      bestCount = count;
      bestHour = hour;
    }
  });
  const activeHours = Math.max(1, hourBuckets.size);
  const avgPerHour = Math.round(dayPhotos.length / activeHours);
  const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
  return {
    avgPerHour,
    peakLabel: bestHour >= 0 ? `พีค ${pad(bestHour)}` : '--:--',
    peakRange: bestHour >= 0 ? `${pad(bestHour)} - ${pad((bestHour + 1) % 24)}` : '--:--',
  };
}
