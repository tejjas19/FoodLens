-- FoodLens schema for a fresh Supabase project.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- (Or `supabase db push` if you use the Supabase CLI.)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  dietary_preference text,
  daily_calorie_goal integer not null default 2000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  meal_type text not null default 'snack',
  image_path text,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  health_score integer not null default 0,
  analysis jsonb not null default '{}'::jsonb,
  eaten_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index meals_user_eaten_idx on public.meals (user_id, eaten_at desc);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text,
  image_path text,
  calories numeric,
  health_score integer,
  recipe text,
  tags text[] not null default '{}',
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint posts_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade
);
create index posts_created_idx on public.posts (created_at desc);

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'FoodLens user'
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users created before this migration ran (if any) still get a profile.
insert into public.profiles (id, display_name)
select u.id, coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'FoodLens user')
from auth.users u
on conflict (id) do nothing;

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create function public.sync_post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger post_likes_count_sync
  after insert or delete on public.post_likes
  for each row execute function public.sync_post_likes_count();

-- Trigger functions must not be callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_post_likes_count() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;

-- profiles: the community feed shows author names, so everyone can read.
-- Signed-out visitors are limited to non-sensitive columns by the grants below.
create policy "profiles are readable" on public.profiles
  for select to anon, authenticated using (true);
create policy "users insert their own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "users update their own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

revoke select on public.profiles from anon;
grant select (id, display_name, avatar_url) on public.profiles to anon;

-- meals: private to the owner.
create policy "users read their own meals" on public.meals
  for select to authenticated using (auth.uid() = user_id);
create policy "users insert their own meals" on public.meals
  for insert to authenticated with check (auth.uid() = user_id);
create policy "users update their own meals" on public.meals
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete their own meals" on public.meals
  for delete to authenticated using (auth.uid() = user_id);

-- posts: public feed, owner writes.
create policy "posts are readable" on public.posts
  for select to anon, authenticated using (true);
create policy "users insert their own posts" on public.posts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "users update their own posts" on public.posts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete their own posts" on public.posts
  for delete to authenticated using (auth.uid() = user_id);

-- Clients must not be able to forge like counts; the trigger maintains them.
-- (Column privileges only take effect once the table-wide privilege is revoked.)
revoke insert, update on public.posts from authenticated;
grant insert (user_id, title, body, image_path, calories, health_score, recipe, tags)
  on public.posts to authenticated;
grant update (title, body, image_path, calories, health_score, recipe, tags)
  on public.posts to authenticated;

-- post_likes
create policy "users read their own likes" on public.post_likes
  for select to authenticated using (auth.uid() = user_id);
create policy "users like as themselves" on public.post_likes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "users remove their own likes" on public.post_likes
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage (private buckets, images are served through signed URLs)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('meal-images', 'meal-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('community-images', 'community-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files live under "<user id>/<file name>".
create policy "meal images: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "meal images: owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "meal images: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'meal-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- The community page is public, so anyone may create signed URLs for these.
create policy "community images: public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'community-images');
create policy "community images: owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'community-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "community images: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'community-images' and (storage.foldername(name))[1] = auth.uid()::text);
