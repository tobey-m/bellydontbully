'use client';

import { useEffect } from 'react';

// บอทของ IG/LINE/Facebook อ่านแค่ meta tag แล้วหยุด คนจริงจะถูกพาเข้าแผนที่ทันที
export default function RedirectHome({ to }: { to: string }) {
  useEffect(() => { window.location.replace(to); }, [to]);
  return null;
}
