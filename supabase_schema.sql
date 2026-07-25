-- Supabase PostgreSQL Database Schema
-- Run this in your Supabase SQL Editor to set up all tables, RLS policies, and triggers.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. BUSINESSES TABLE
create table if not exists public.businesses (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    owner_id uuid not null references auth.users(id) on delete cascade,
    settings jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on businesses
alter table public.businesses enable row level security;

-- Policies for businesses
create policy "Users can perform all actions on their own businesses"
    on public.businesses for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 2. BRANCHES TABLE
create table if not exists public.branches (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

alter table public.branches enable row level security;

create policy "Users can perform all actions on their branches"
    on public.branches for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 3. STAFF TABLE
create table if not exists public.staff (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    phone text not null,
    daily_salary numeric not null,
    join_date text not null,
    status text not null check (status in ('active', 'archived')),
    photo text, -- base64 string
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

alter table public.staff enable row level security;

create policy "Users can perform all actions on their staff"
    on public.staff for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 4. ATTENDANCE TABLE
create table if not exists public.attendance (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    staff_id uuid not null references public.staff(id) on delete cascade,
    date text not null,
    attendance_value numeric not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

alter table public.attendance enable row level security;

create policy "Users can perform all actions on their attendance records"
    on public.attendance for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 5. CUSTOM CATEGORIES TABLE
create table if not exists public.custom_categories (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    type text not null check (type in ('income', 'expense', 'both')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

alter table public.custom_categories enable row level security;

create policy "Users can perform all actions on their categories"
    on public.custom_categories for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 6. EXPENSE GROUPS TABLE
create table if not exists public.expense_groups (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

alter table public.expense_groups enable row level security;

create policy "Users can perform all actions on their expense groups"
    on public.expense_groups for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 7. CASH LOGS TABLE
create table if not exists public.cash_logs (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    group_id uuid references public.expense_groups(id) on delete set null,
    type text not null check (type in ('income', 'expense')),
    category text not null,
    amount numeric not null,
    date text not null,
    time text not null,
    party_name text,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

alter table public.cash_logs enable row level security;

create policy "Users can perform all actions on their cash logs"
    on public.cash_logs for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 8. CUSTOMERS TABLE
create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    phone text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

alter table public.customers enable row level security;

create policy "Users can perform all actions on their customers"
    on public.customers for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 9. CUSTOMER ORDERS TABLE
create table if not exists public.customer_orders (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    customer_id uuid not null references public.customers(id) on delete cascade,
    product_bought text not null,
    total_amount numeric not null,
    advance numeric not null,
    dues numeric not null,
    delivery_date text not null,
    status text not null check (status in ('pending', 'in-production', 'delivered')),
    delivery_fee_type text not null check (delivery_fee_type in ('included', 'free', 'not-from-us', 'custom')),
    delivery_fee_amount numeric,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

alter table public.customer_orders enable row level security;

create policy "Users can perform all actions on their customer orders"
    on public.customer_orders for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 10. CUSTOMER DUES TABLE
create table if not exists public.customer_dues (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    order_id uuid references public.customer_orders(id) on delete set null,
    customer_name text not null,
    customer_phone text,
    amount numeric not null,
    date text not null,
    notes text,
    status text not null check (status in ('pending', 'received')),
    received_date text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

alter table public.customer_dues enable row level security;

create policy "Users can perform all actions on their customer dues"
    on public.customer_dues for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 11. SALES TABLE
create table if not exists public.sales (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    order_id uuid references public.customer_orders(id) on delete set null,
    product_name text not null,
    description text,
    sold_for numeric not null,
    total_cost numeric not null,
    profit numeric not null,
    cost_breakdown jsonb default '[]'::jsonb,
    date text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

alter table public.sales enable row level security;

create policy "Users can perform all actions on their sales"
    on public.sales for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 12. VENDORS TABLE
create table if not exists public.vendors (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    phone text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

alter table public.vendors enable row level security;

create policy "Users can perform all actions on their vendors"
    on public.vendors for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 13. PRODUCTION ENTRIES TABLE
create table if not exists public.production_entries (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    vendor_id uuid not null references public.vendors(id) on delete cascade,
    name text not null,
    price numeric not null,
    unit numeric not null,
    description text,
    remarks text,
    contact_no text,
    type text not null check (type in ('product', 'service', 'other')),
    additional_charges jsonb default '[]'::jsonb,
    total_amount numeric not null,
    status text not null check (status in ('unpaid', 'paid')),
    paid_amount numeric default 0,
    paid_at numeric,
    date text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_at timestamp with time zone
);

alter table public.production_entries enable row level security;

create policy "Users can perform all actions on their production entries"
    on public.production_entries for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 14. NOTES TABLE
create table if not exists public.notes (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    content text not null,
    created_at numeric not null,
    updated_at numeric not null,
    deleted_at timestamp with time zone
);

alter table public.notes enable row level security;

create policy "Users can perform all actions on their notes"
    on public.notes for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 15. CFT CALCULATIONS TABLE
create table if not exists public.cft_calculations (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    label text not null,
    thickness numeric not null,
    thickness_unit text not null,
    width numeric not null,
    width_unit text not null,
    length numeric not null,
    length_unit text not null,
    quantity numeric not null,
    cft_per_piece numeric not null,
    total_cft numeric not null,
    created_at numeric not null,
    deleted_at timestamp with time zone
);

alter table public.cft_calculations enable row level security;

create policy "Users can perform all actions on their calculations"
    on public.cft_calculations for all
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

-- 16. AUTO-UPDATE TIMESTAMP FUNCTION & TRIGGERS
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

create trigger set_updated_at_businesses before update on public.businesses for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_branches before update on public.branches for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_staff before update on public.staff for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_attendance before update on public.attendance for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_custom_categories before update on public.custom_categories for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_expense_groups before update on public.expense_groups for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_cash_logs before update on public.cash_logs for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_customers before update on public.customers for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_customer_orders before update on public.customer_orders for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_customer_dues before update on public.customer_dues for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_sales before update on public.sales for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_vendors before update on public.vendors for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_production_entries before update on public.production_entries for each row execute procedure public.handle_updated_at();
create trigger set_updated_at_notes before update on public.notes for each row execute procedure public.handle_updated_at();

-- 17. INDEXES FOR PERFORMANCE
create index if not exists idx_businesses_owner on public.businesses(owner_id);
create index if not exists idx_branches_business on public.branches(business_id);
create index if not exists idx_staff_branch on public.staff(branch_id);
create index if not exists idx_attendance_date on public.attendance(date);
create index if not exists idx_cash_logs_date on public.cash_logs(date);
create index if not exists idx_customer_orders_delivery on public.customer_orders(delivery_date);
create index if not exists idx_customer_dues_status on public.customer_dues(status);
