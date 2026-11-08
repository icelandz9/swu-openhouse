'use client';

// StaffGate for SWU Open House PhotoBooth
// Dedicated onsite booth operator: opens immediately without PIN blocking.
import React from 'react';

export function StaffGate({
  title = 'Staff Mission Control Center',
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
