-- Migration 006: seed auction participants with email/password login
-- Password for all accounts: 12345678
-- Run this in Supabase SQL editor ONCE.

insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
)
values
  (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'sherlockholmes221b715@gmail.com',
    crypt('12345678', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Wayanad Tarzans"}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'abhijithbabu855@gmail.com',
    crypt('12345678', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"OPM"}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'sonushajim@gmail.com',
    crypt('12345678', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Malabar Magic"}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'lonewolf6996a@gmail.com',
    crypt('12345678', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Kerala Indians"}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'abiddileep7@gmail.com',
    crypt('12345678', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Mumbai Indians"}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'gpy120643@gmail.com',
    crypt('12345678', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Goated Super Kings"}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'swabeehca@gmail.com',
    crypt('12345678', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}',
    '{"full_name":"Kerala Blasters"}',
    now(), now(), 'authenticated', 'authenticated'
  )
on conflict (email) do nothing;

-- Sync into public.users so the app can see them
insert into public.users (id, email, display_name)
select id, email, raw_user_meta_data->>'full_name'
from auth.users
where email in (
  'sherlockholmes221b715@gmail.com',
  'abhijithbabu855@gmail.com',
  'sonushajim@gmail.com',
  'lonewolf6996a@gmail.com',
  'abiddileep7@gmail.com',
  'gpy120643@gmail.com',
  'swabeehca@gmail.com'
)
on conflict (id) do nothing;
