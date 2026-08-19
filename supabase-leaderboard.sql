-- 飞花棋 · 云端排行榜（Supabase）
-- 在 Supabase 控制台的 SQL Editor 中执行本脚本，建立 leaderboard 表并开放匿名读取/写入。
-- 之后把项目的 URL 与 anon/publishable key 填入游戏 config/leaderboard.json 即可。
-- 本脚本可重复执行（幂等），已存在的表/约束/策略不会报错。

create table if not exists public.leaderboard (
  id    bigint generated always as identity primary key,
  name  text        not null,
  score integer     not null,
  ts    timestamptz not null default now()
);

-- 分数非负约束（可选防刷）。
-- 注意：PostgreSQL 不支持 "ADD CONSTRAINT IF NOT EXISTS"，故用 DO 块幂等添加，避免重复执行报错。
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leaderboard_score_nonneg'
  ) then
    alter table public.leaderboard
      add constraint leaderboard_score_nonneg check (score >= 0);
  end if;
end $$;

-- 开启行级安全（RLS）
alter table public.leaderboard enable row level security;

-- 匿名可读：菜单「云端排行榜」查询接口需要
drop policy if exists "anon read leaderboard" on public.leaderboard;
create policy "anon read leaderboard"
  on public.leaderboard for select
  using (true);

-- 匿名可写：通关提交分数需要
drop policy if exists "anon insert leaderboard" on public.leaderboard;
create policy "anon insert leaderboard"
  on public.leaderboard for insert
  with check (true);

-- （可选）如需禁止玩家改/删他人成绩，不要创建 update/delete 策略即可。
-- 如需限制每人提交频率，可在此基础上加更细的 RLS 或数据库函数。
