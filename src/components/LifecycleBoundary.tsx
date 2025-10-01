"use client";

import { ReactNode } from 'react';
import { useLifecycleCleanup } from '@/hooks';

export function LifecycleBoundary({ children }: { children: ReactNode }) {
  useLifecycleCleanup();
  return <>{children}</>;
}

