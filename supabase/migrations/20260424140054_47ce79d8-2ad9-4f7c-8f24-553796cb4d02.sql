-- 1. Update get_email_by_username to read from auth.users instead of profiles.email
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email::text
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE lower(p.username) = lower(_username)
  LIMIT 1;
$$;

-- 2. Drop email column from profiles (no longer needed publicly; auth.users has it)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- 3. Update handle_new_user trigger to not insert email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$function$;

-- 4. Restore the original simple "viewable by everyone" policy on profiles
DROP POLICY IF EXISTS "Public profile fields readable by anyone" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view full profiles" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (true);

-- 5. Explicit deny-read policies on feedback and reports (admin/service-only)
CREATE POLICY "No public read access to feedback"
ON public.feedback
FOR SELECT
TO anon, authenticated
USING (false);

CREATE POLICY "No public read access to reports"
ON public.reports
FOR SELECT
TO anon, authenticated
USING (false);

-- 6. Add UPDATE policy for audio bucket scoped to owner folder
CREATE POLICY "Users can update their own audio"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);
