create table api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  created_at timestamptz default now(),
  last_used_at timestamptz
);

create index api_keys_user_id_idx on api_keys(user_id);
create index api_keys_key_hash_idx on api_keys(key_hash);

alter table api_keys enable row level security;

create policy "Users can view own keys"
  on api_keys for select
  using ((select auth.uid()) = user_id);

create policy "Users can delete own keys"
  on api_keys for delete
  using ((select auth.uid()) = user_id);
