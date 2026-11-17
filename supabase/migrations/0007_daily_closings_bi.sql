-- Migration 0007: Daily Closings & Executive BI Snapshot Support
create table if not exists public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  closing_date date not null,
  morning_cash_paisa bigint not null default 0,
  evening_cash_paisa bigint not null default 0,
  night_cash_paisa bigint not null default 0,
  gross_sales_paisa bigint not null default 0,
  refunds_paisa bigint not null default 0,
  net_sales_paisa bigint not null default 0,
  digital_sales_paisa bigint not null default 0,
  total_expenses_paisa bigint not null default 0,
  total_wages_paisa bigint not null default 0,
  expected_closing_paisa bigint not null default 0,
  actual_closing_paisa bigint not null default 0,
  cash_variance_paisa bigint not null default 0,
  expenses_json jsonb not null default '[]'::jsonb,
  wages_json jsonb not null default '[]'::jsonb,
  notes text,
  status text not null default 'SUBMITTED',
  prepared_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, closing_date)
);

alter table public.daily_closings enable row level security;

create policy "daily_closings_member_read"
  on public.daily_closings for select
  using (
    exists (
      select 1 from public.memberships m
      where m.business_id = daily_closings.business_id
        and m.profile_id = auth.uid()
        and m.status = 'ACTIVE'
    )
  );

create policy "daily_closings_owner_manager_write"
  on public.daily_closings for all
  using (
    exists (
      select 1 from public.memberships m
      join public.roles r on r.id = m.role_id
      where m.business_id = daily_closings.business_id
        and m.profile_id = auth.uid()
        and m.status = 'ACTIVE'
        and r.code in ('OWNER', 'MANAGER')
    )
  );
