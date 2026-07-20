# Demo user setup

The deterministic seed creates fictional profiles, workspace membership, and project data, but deliberately creates no Supabase Auth account or password. Provision one email/password account manually for the demo and map its generated Auth UUID to the seeded workspace.

## Before you start

- Confirm the Supabase Dashboard is open on the intended InOrdo project.
- Choose a team-controlled demo email address and a unique password outside this repository.
- Never paste the password into source, an issue, a commit, a screenshot, or a shared log.
- Keep `.env.local` untracked and do not expose project keys in command output.

## 1. Create the Auth account

1. In the Supabase Dashboard, open **Authentication > Users**.
2. Choose **Add user** and create an email/password user. Mark the address confirmed only when that matches the team's demo policy.
3. Copy the new user's UUID from the user record. Do not copy the password anywhere else.

The database's Auth trigger should create a `public.profiles` row with the same UUID. The seeded fictional profiles remain credential-free.

## 2. Add the account to the demo workspace

Open the Dashboard SQL Editor for the same project. Replace `<AUTH_USER_UUID>` once, review the target slug, and run this block:

```sql
do $$
declare
  demo_auth_user_id uuid := '<AUTH_USER_UUID>'::uuid;
  demo_workspace_id uuid;
  demo_inviter_id uuid;
begin
  if not exists (
    select 1
    from auth.users
    where id = demo_auth_user_id
  ) then
    raise exception 'The supplied UUID is not an Auth user in this project';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = demo_auth_user_id
  ) then
    raise exception 'The Auth profile trigger did not create a matching profile';
  end if;

  select id, created_by
  into demo_workspace_id, demo_inviter_id
  from public.workspaces
  where slug = 'civic-futures-lab-demo';

  if demo_workspace_id is null then
    raise exception 'The seeded demo workspace was not found';
  end if;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    invited_by
  )
  values (
    demo_workspace_id,
    demo_auth_user_id,
    'admin',
    demo_inviter_id
  )
  on conflict (workspace_id, user_id)
  do update set role = excluded.role;
end
$$;
```

This grants admin access to the existing synthetic workspace; it does not replace or demote the seeded owner. Run it only against the intended linked project.

## 3. Configure the application locally

Copy `.env.example` to `.env.local` and supply values for these names without committing or printing them:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` only when a narrowly reviewed server-only operation requires it
- `DEMO_PROJECT_SLUG`

Ordinary login and project reads must not use `SUPABASE_SERVICE_ROLE_KEY`.

## 4. Manually verify the configured account

1. Start the application with Node.js 22 and `npm run dev`.
2. Open `/login`, sign in with the manually created account, and confirm the destination remains on the local application.
3. Confirm the protected project view renders the seeded Regional Climate Action Summit data.
4. Sign out, then confirm the protected route no longer loads project data.
5. Try an invalid password and confirm the page shows a useful error without exposing credentials or Supabase internals.

The operator-managed demo account has completed local login plus authenticated production project-record, dependency, rollback, and reset smoke. A fresh signed-out/login/session-refresh/logout pass remains part of the final public-release checklist; no password or Auth UUID is recorded here.
