'use client';

// StaffGate for SWU Open House PhotoBooth
// Single dedicated operator on kiosk laptop: opens immediately without PIN blocking.
import React from 'react';

export function StaffGate({ title, children }: { title: string; children: React.ReactNode }) {
  // Onsite operator mode: instant direct access for the booth operator
  return <>{children}</>;
}
