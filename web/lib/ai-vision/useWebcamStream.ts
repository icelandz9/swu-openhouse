'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Opens a landscape 1080p webcam stream (WebRTC getUserMedia).
 * Lists every camera Windows exposes, so a virtual camera (Camo / Iriun on an iPad)
 * can be picked from a dropdown.
 */
export function useWebcamStream() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);

  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    setDevices(all.filter((d) => d.kind === 'videoinput'));
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      setIsReady(false);
      setError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60 },
          },
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setIsReady(true);
        await refreshDevices(); // labels are only available after permission is granted
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'ไม่ได้รับสิทธิ์ใช้กล้อง — กดอนุญาตที่แถบ URL'
            : name === 'NotFoundError'
              ? 'ไม่พบกล้อง — ต่อกล้องแล้วรีเฟรชหน้า'
              : 'เปิดกล้องไม่สำเร็จ'
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [deviceId, refreshDevices]);

  return { videoRef, isReady, error, devices, deviceId, setDeviceId };
}
