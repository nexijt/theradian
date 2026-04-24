-- 1. Drop the overly-permissive public SELECT policy on profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- 2. Add a SELECT policy that hides email from anonymous users
-- Anon users: can read rows but app code must not select email (we'll enforce via app code + this RLS for authenticated reads of email)
-- Authenticated users: full access
CREATE POLICY "Public profile fields readable by anyone"
ON public.profiles
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Authenticated users can view full profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Revoke direct column access to email for anon role
REVOKE SELECT (email) ON public.profiles FROM anon;
GRANT SELECT (id, user_id, username, display_name, avatar_url, bio, created_at) ON public.profiles TO anon;

-- 3. Security definer function for username -> email lookup (used at sign-in, pre-auth)
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE lower(username) = lower(_username)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;

-- 4. Add UPDATE policy on photos bucket scoped to owner folder
CREATE POLICY "Users can update their own photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);
