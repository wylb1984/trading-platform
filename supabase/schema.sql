create table if not exists public.watchlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  market text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.portfolio_draft_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  market text not null,
  quantity numeric not null,
  average_cost numeric not null
);

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  market_data_provider text not null,
  ai_provider text not null,
  default_markets text[] not null,
  risk_profile text not null,
  notification_config jsonb
);

alter table public.app_settings add column if not exists notification_config jsonb;

create table if not exists public.trade_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  market text not null,
  side text not null,
  quantity numeric not null,
  price numeric not null,
  fee numeric not null default 0,
  trade_date date not null,
  note text
);

create table if not exists public.cash_flows (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  flow_date date not null,
  type text not null,
  note text
);

alter table public.watchlist_items drop constraint if exists watchlist_items_pkey;
alter table public.watchlist_items add primary key (user_id, symbol);

alter table public.portfolio_draft_items drop constraint if exists portfolio_draft_items_pkey;
alter table public.portfolio_draft_items add primary key (user_id, symbol);

alter table public.watchlist_items enable row level security;
alter table public.portfolio_draft_items enable row level security;
alter table public.app_settings enable row level security;
alter table public.trade_logs enable row level security;
alter table public.cash_flows enable row level security;

drop policy if exists "watchlist_select_own" on public.watchlist_items;
drop policy if exists "watchlist_insert_own" on public.watchlist_items;
drop policy if exists "watchlist_update_own" on public.watchlist_items;
drop policy if exists "watchlist_delete_own" on public.watchlist_items;
create policy "watchlist_select_own" on public.watchlist_items for select using (auth.uid() = user_id);
create policy "watchlist_insert_own" on public.watchlist_items for insert with check (auth.uid() = user_id);
create policy "watchlist_update_own" on public.watchlist_items for update using (auth.uid() = user_id);
create policy "watchlist_delete_own" on public.watchlist_items for delete using (auth.uid() = user_id);

drop policy if exists "portfolio_select_own" on public.portfolio_draft_items;
drop policy if exists "portfolio_insert_own" on public.portfolio_draft_items;
drop policy if exists "portfolio_update_own" on public.portfolio_draft_items;
drop policy if exists "portfolio_delete_own" on public.portfolio_draft_items;
create policy "portfolio_select_own" on public.portfolio_draft_items for select using (auth.uid() = user_id);
create policy "portfolio_insert_own" on public.portfolio_draft_items for insert with check (auth.uid() = user_id);
create policy "portfolio_update_own" on public.portfolio_draft_items for update using (auth.uid() = user_id);
create policy "portfolio_delete_own" on public.portfolio_draft_items for delete using (auth.uid() = user_id);

drop policy if exists "settings_select_own" on public.app_settings;
drop policy if exists "settings_insert_own" on public.app_settings;
drop policy if exists "settings_update_own" on public.app_settings;
create policy "settings_select_own" on public.app_settings for select using (auth.uid() = user_id);
create policy "settings_insert_own" on public.app_settings for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.app_settings for update using (auth.uid() = user_id);

drop policy if exists "trade_logs_select_own" on public.trade_logs;
drop policy if exists "trade_logs_insert_own" on public.trade_logs;
drop policy if exists "trade_logs_update_own" on public.trade_logs;
drop policy if exists "trade_logs_delete_own" on public.trade_logs;
create policy "trade_logs_select_own" on public.trade_logs for select using (auth.uid() = user_id);
create policy "trade_logs_insert_own" on public.trade_logs for insert with check (auth.uid() = user_id);
create policy "trade_logs_update_own" on public.trade_logs for update using (auth.uid() = user_id);
create policy "trade_logs_delete_own" on public.trade_logs for delete using (auth.uid() = user_id);

drop policy if exists "cash_flows_select_own" on public.cash_flows;
drop policy if exists "cash_flows_insert_own" on public.cash_flows;
drop policy if exists "cash_flows_update_own" on public.cash_flows;
drop policy if exists "cash_flows_delete_own" on public.cash_flows;
create policy "cash_flows_select_own" on public.cash_flows for select using (auth.uid() = user_id);
create policy "cash_flows_insert_own" on public.cash_flows for insert with check (auth.uid() = user_id);
create policy "cash_flows_update_own" on public.cash_flows for update using (auth.uid() = user_id);
create policy "cash_flows_delete_own" on public.cash_flows for delete using (auth.uid() = user_id);
