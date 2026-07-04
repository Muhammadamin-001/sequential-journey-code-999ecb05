 -- 20260619071322 revoked EXECUTE on has_role() from `authenticated`, but
 -- almost every RLS policy (sections, tasks, user_roles, admin_settings, ...)
 -- calls has_role(auth.uid(), 'admin') internally. Without EXECUTE, any
 -- INSERT/UPDATE/DELETE/SELECT touching those policies fails with
 -- "permission denied for function has_role" — even for admins.
 GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;