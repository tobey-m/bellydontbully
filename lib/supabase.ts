-- ============================================================
-- BELLY DON'T BULLY — แก้ระบบไลค์ให้ปลอดภัย
-- รันใน Supabase → SQL Editor ทีละขั้น
-- ============================================================

-- ขั้นที่ 1: สร้างฟังก์ชันบวก/ลบไลค์แบบ atomic (ปลอดภัยที่จะรันทันที ไม่กระทบของเดิม)
create or replace function public.adjust_like(p_id bigint, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_likes integer;
begin
  if p_delta not in (-1, 1) then
    raise exception 'invalid delta';
  end if;

  update public.cats
     set likes_count = greatest(0, coalesce(likes_count, 0) + p_delta)
   where id = p_id
   returning likes_count into v_likes;

  return v_likes;  -- null ถ้าไม่พบแมว id นี้
end;
$$;

revoke all on function public.adjust_like(bigint, integer) from public;
grant execute on function public.adjust_like(bigint, integer) to anon, authenticated;

-- ============================================================
-- ขั้นที่ 2: deploy page.tsx ตัวใหม่ แล้วทดสอบกดไลค์ให้ผ่านก่อน
--           (ถ้าข้ามไปทำขั้นที่ 3 ก่อน ปุ่มไลค์ของเว็บเวอร์ชันเก่าจะพัง)
-- ============================================================

-- ขั้นที่ 3: ตรวจว่าตอนนี้ anon อัปเดตตาราง cats ตรงๆ ได้ไหม
select policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'cats';

-- ถ้าเห็น policy ที่ cmd = 'UPDATE' (หรือ 'ALL') ให้ anon ใช้ได้ → ใครก็ตั้ง likes_count เป็นเลขอะไรก็ได้
-- ให้ลบ policy นั้น โดยแทนชื่อด้วยชื่อจริงที่ query ข้างบนแสดง:
--
--   drop policy "ชื่อ policy ที่เป็น UPDATE" on public.cats;
--
-- และถอนสิทธิ์ระดับตาราง (กันกรณีไม่ได้เปิด RLS):
--
--   revoke update on public.cats from anon;
--
-- ⚠️ ก่อนทำ: เช็กว่า edit_cat_v2 ประกาศเป็น "security definer" ไม่งั้นการแก้ไขแมวจะพังหลังถอนสิทธิ์
--   select proname, prosecdef from pg_proc where proname = 'edit_cat_v2';   -- prosecdef ต้องเป็น true
-- ทดสอบ: กดไลค์ + แก้ไขแมว 1 ตัว ต้องยังใช้ได้ทั้งคู่
