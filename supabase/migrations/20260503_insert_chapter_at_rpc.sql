-- insert_chapter_at(p_book_id, p_user_id, p_insert_at, p_title, p_brief)
--
-- Atomically inserts a new chapter at p_insert_at, shifting every existing
-- chapter at that index or higher by +1. Also increments any
-- framework_data.steps[*].chapter_index that sits at or after the insertion
-- point, so the framework-letter overlay (e.g. C/R/E/D/I/T) keeps mapping to
-- the same logical content after the shift.
--
-- Why a function instead of two client-side calls: book_pages has a
-- non-deferrable unique index on (book_id, chapter_index). A naive
-- "UPDATE ... SET chapter_index = chapter_index + 1 WHERE chapter_index >= N"
-- raises a unique violation as soon as the first row collides with the row
-- it's trying to push into. Splitting into two updates via a temporary
-- 1_000_000 offset side-steps that without dropping or modifying the index.
--
-- The new chapter never claims a framework letter — it always lands as a
-- non-step chapter regardless of position. Adding a new framework letter
-- (turning C.R.E.D.I.T. into something else) is a separate, deliberate
-- operation that doesn't belong in this RPC.
--
-- Returns the id of the new book_pages row.

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
