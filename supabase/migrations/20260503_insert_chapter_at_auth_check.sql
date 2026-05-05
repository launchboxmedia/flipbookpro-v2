-- Adds an auth-uid check at the top of insert_chapter_at so the caller can
-- never pass someone else's user_id and have the RPC act on their behalf.
--
-- Without this, the original function only verified that p_user_id matched
-- the book's owner — fine for honest callers, but a malicious authenticated
-- user could pass another user's id and (if they happened to also pass that
-- user's book id) trigger writes against a book they don't own. With
-- SECURITY DEFINER bypassing RLS, this check is the only thing standing
-- between the JWT identity and the function body.
--
-- Re-creates the function via CREATE OR REPLACE; the body is otherwise
-- identical to 20260503_insert_chapter_at_rpc.sql.

CREATE OR REPLACE FUNCTION public.insert_chapter_at(
  p_book_id   uuid,
  p_user_id   uuid,
  p_insert_at int,
  p_title     text,
  p_brief     text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner  uuid;
  v_new_id uuid;
BEGIN
  -- Identity check: caller cannot impersonate another user. auth.uid() is
  -- pulled from the JWT and cannot be spoofed; p_user_id is whatever the
  -- client sent. They must match.
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'insert_chapter_at: caller user does not match authenticated session'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Input validation
  IF p_insert_at IS NULL OR p_insert_at < 0 THEN
    RAISE EXCEPTION 'insert_chapter_at: insert_at must be >= 0 (got %)', p_insert_at;
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'insert_chapter_at: title is required';
  END IF;
  IF p_brief IS NULL OR length(trim(p_brief)) = 0 THEN
    RAISE EXCEPTION 'insert_chapter_at: brief is required';
  END IF;

  -- Ownership check — defense in depth alongside RLS. SECURITY DEFINER
  -- bypasses RLS, so we must enforce ownership ourselves.
  SELECT user_id INTO v_owner FROM public.books WHERE id = p_book_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'insert_chapter_at: book not found'
      USING ERRCODE = 'no_data_found';
  END IF;
  IF v_owner <> p_user_id THEN
    RAISE EXCEPTION 'insert_chapter_at: caller does not own this book'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Phase 1: park affected rows in a temporary 1M+ range so a direct +1
  -- shift can't hit a transient unique-index violation.
  UPDATE public.book_pages
     SET chapter_index = chapter_index + 1000000
   WHERE book_id = p_book_id
     AND chapter_index >= p_insert_at;

  -- Phase 2: settle them at chapter_index + 1 (their final position).
  UPDATE public.book_pages
     SET chapter_index = chapter_index - 999999
   WHERE book_id = p_book_id
     AND chapter_index >= 1000000;

  -- Shift framework_data step indices in lockstep so the framework-letter
  -- overlay still lands on the correct chapter after the renumber. Defensive
  -- against missing/malformed entries: only steps with a numeric
  -- chapter_index >= p_insert_at are bumped; everything else is left alone.
  UPDATE public.books
     SET framework_data = jsonb_set(
           framework_data,
           '{steps}',
           COALESCE((
             SELECT jsonb_agg(
               CASE
                 WHEN step ? 'chapter_index'
                      AND jsonb_typeof(step->'chapter_index') = 'number'
                      AND (step->>'chapter_index')::int >= p_insert_at
                 THEN jsonb_set(step, '{chapter_index}', to_jsonb((step->>'chapter_index')::int + 1))
                 ELSE step
               END
               ORDER BY ord
             )
             FROM jsonb_array_elements(framework_data->'steps') WITH ORDINALITY AS arr(step, ord)
           ), '[]'::jsonb)
         ),
         updated_at = now()
   WHERE id = p_book_id
     AND framework_data IS NOT NULL
     AND jsonb_typeof(framework_data->'steps') = 'array';

  -- Insert the new chapter as a blank, unapproved row.
  INSERT INTO public.book_pages
    (book_id, chapter_index, chapter_title, chapter_brief, approved, content, image_url)
  VALUES
    (p_book_id, p_insert_at, trim(p_title), trim(p_brief), false, NULL, NULL)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_chapter_at(uuid, uuid, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_chapter_at(uuid, uuid, int, text, text) TO authenticated;
