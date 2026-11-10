-- Contact page enquiries (also emailed to CONTACT_TO). Only the server can read/write.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  topic text not null,
  service text,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
grant all on public.contact_messages to service_role;
alter table public.contact_messages enable row level security;
