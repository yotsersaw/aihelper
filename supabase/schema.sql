-- Enable extension for UUID generation
create extension if not exists pgcrypto;

create table if not exists bots (
  id uuid primary key default gen_random_uuid(),
  public_bot_id text not null unique,
  company_name text not null,
  niche text,
  system_prompt text not null,
  model text not null default 'openai/gpt-4o-mini',
  temperature numeric(3,2) not null default 0.3 check (temperature >= 0 and temperature <= 2),
  max_completion_tokens integer not null default 350 check (max_completion_tokens between 64 and 4096),
  allowed_domain text not null default '*',
  handoff_email text,
  monthly_token_limit integer not null default 200000 check (monthly_token_limit > 0),
  monthly_cost_limit numeric(10,2) not null default 50 check (monthly_cost_limit > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references bots(id) on delete cascade,
  session_id text not null,
  source_page text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bot_id, session_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  token_count integer not null default 0,
  cost numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references bots(id) on delete cascade,
  session_id text not null,
  name text not null,
  phone text,
  email text,
  note text,
  source_page text,
  created_at timestamptz not null default now()
);

create table if not exists usage_daily (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references bots(id) on delete cascade,
  usage_date date not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  total_cost numeric(10,6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bot_id, usage_date)
);

create index if not exists idx_conversations_bot_last_message on conversations(bot_id, last_message_at desc);
create index if not exists idx_messages_conversation_created_at on messages(conversation_id, created_at);
create index if not exists idx_leads_bot_created_at on leads(bot_id, created_at desc);
create index if not exists idx_usage_daily_bot_date on usage_daily(bot_id, usage_date desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger trg_bots_updated_at
before update on bots
for each row execute procedure set_updated_at();

create or replace trigger trg_conversations_updated_at
before update on conversations
for each row execute procedure set_updated_at();

create or replace trigger trg_usage_daily_updated_at
before update on usage_daily
for each row execute procedure set_updated_at();

create or replace function upsert_usage_daily(
  p_bot_id uuid,
  p_usage_date date,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_total_tokens integer,
  p_total_cost numeric
)
returns void as $$
begin
  insert into usage_daily (bot_id, usage_date, prompt_tokens, completion_tokens, total_tokens, total_cost)
  values (p_bot_id, p_usage_date, p_prompt_tokens, p_completion_tokens, p_total_tokens, p_total_cost)
  on conflict (bot_id, usage_date)
  do update set
    prompt_tokens = usage_daily.prompt_tokens + excluded.prompt_tokens,
    completion_tokens = usage_daily.completion_tokens + excluded.completion_tokens,
    total_tokens = usage_daily.total_tokens + excluded.total_tokens,
    total_cost = usage_daily.total_cost + excluded.total_cost,
    updated_at = now();
end;
$$ language plpgsql;

-- Demo seed bot
insert into bots (
  public_bot_id,
  company_name,
  niche,
  system_prompt,
  model,
  temperature,
  max_completion_tokens,
  allowed_domain,
  handoff_email,
  monthly_token_limit,
  monthly_cost_limit,
  is_active
)
values (
  'demo-dental',
  'Demo Dental Clinic',
  'dental',
  'You are the polite assistant of Demo Dental Clinic. Keep answers short and practical in Russian. Never invent unavailable facts. If info is missing, offer lead capture: ask for name, phone, email, and preferred visit time. If user asks for impossible things, explain limitations and suggest contact with manager.',
  'openai/gpt-4o-mini',
  0.3,
  350,
  '*',
  'manager@demodental.local',
  200000,
  50,
  true
)
on conflict (public_bot_id) do nothing;
