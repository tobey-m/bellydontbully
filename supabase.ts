import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// เช็กว่ามีการใส่ Key ใน .env.local แล้วหรือยัง
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const BUCKET = 'cat-photos';
const MAX_SIDE = 1080;   // ด้านยาวสุดหลังย่อ (การ์ด IG ใช้รูปวงกลมรัศมี 250px ไม่ต้องใหญ่กว่านี้)
const QUALITY = 0.85;

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ย่อรูป + แปลงเป็น WebP (ถ้าเบราว์เซอร์ไม่รองรับจะเป็น JPEG)
// การวาดผ่าน canvas ทำให้ EXIF (รวมพิกัด GPS ของรูป) ถูกลบทิ้งด้วย
async function compressImage(file: File): Promise<{ blob: Blob; ext: string }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas not supported');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    for (const [type, ext] of [['image/webp', 'webp'], ['image/jpeg', 'jpg']] as const) {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, QUALITY));
      if (blob && blob.type === type) return { blob, ext };
    }
  } catch (err) {
    console.warn('compressImage failed, uploading original', err);
  }
  const ext = (file.name.includes('.') ? file.name.split('.').pop() : '')?.toLowerCase() || 'jpg';
  return { blob: file, ext };
}

// ดึง path ใน bucket ออกจาก public URL
function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

// ลบรูปที่อัปโหลดไปแล้ว (ใช้ตอนบันทึกแมวไม่สำเร็จ จะได้ไม่เหลือรูปค้างใน Storage)
// หมายเหตุ: ต้องมี storage policy ให้ลบได้ ไม่งั้นจะเงียบๆ ไม่ลบ
export async function deleteCatPhotos(urls: string[]): Promise<void> {
  if (!supabase || urls.length === 0) return;
  const paths = urls.map(pathFromPublicUrl).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
}

// อัปโหลดรูปแมวหลายรูปเข้า Storage (ย่อรูป + อัปโหลดพร้อมกัน)
// ถ้ารูปใดรูปหนึ่งล้มเหลว จะลบรูปที่ขึ้นไปแล้วและ throw — ให้ฝั่งเรียกแจ้งผู้ใช้ได้
// (ของเดิมข้ามรูปที่พังไปเงียบๆ แล้วบันทึกแมวโดยไม่มีรูปโดยไม่แจ้งเตือน)
export async function uploadCatPhotos(files: File[]): Promise<string[]> {
  if (!supabase) throw new Error('Supabase is not configured');
  const client = supabase;

  const results = await Promise.allSettled(
    files.map(async (file) => {
      const { blob, ext } = await compressImage(file);
      const path = `${makeId()}.${ext}`;
      const { error } = await client.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type || 'image/jpeg',
        cacheControl: '31536000', // ชื่อไฟล์ไม่ซ้ำ จึงแคชยาวได้
        upsert: false,
      });
      if (error) throw error;
      return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    })
  );

  const urls = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) {
    await deleteCatPhotos(urls);
    throw failed.reason instanceof Error ? failed.reason : new Error('Photo upload failed');
  }
  return urls;
}
