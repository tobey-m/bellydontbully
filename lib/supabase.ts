import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// เช็กว่ามีการใส่ Key ใน .env.local แล้วหรือยัง
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ฟังก์ชันสำหรับอัปโหลดรูปแมวหลายรูปเข้า Storage
export async function uploadCatPhotos(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  
  for (const file of files) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('cat-photos')
      .upload(fileName, file);

    if (!uploadError) {
      const { data } = supabase.storage
        .from('cat-photos')
        .getPublicUrl(fileName);
      urls.push(data.publicUrl);
    } else {
      console.error('Upload error:', uploadError);
    }
  }
  
  return urls;
}