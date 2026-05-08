-- merge_chapters_at(p_book_id, p_user_id, p_keep_index, p_delete_index, p_merged_title, p_merged_brief)
--
-- Merges two adjacent (or non-adjacent) chapters into one. The keep
-- chapter retains its row id and image_url; its title + brief are
-- replaced with the merged values, and content / approved / pull_quote
-- are reset because the prior approved draft no longer matches the
-- merged scope. The delete chapter's row is removed.
--
-- Caller must pass p_keep_index < p_delete_index. The handler in
-- OutlineStage normalises this via Math.min/max before calling.
--
-- Two-phase shift on chapter_index values > p_delete_index avoids
-- transient violations of the (book_id, chapter_index) unique index
-- when the rows above are pulled down by 1.

CREATE OR REPLACE FUNCTION public.merge_chapters_at(
  p_book_id      uuid,
  p_user_id      uuid,
  p_keep_index   int,
  p_delete_index int,
  p_merged_title text,
  p_merged_brief text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner uuid;
BEGIN
  -- Identity check — auth.uid() comes from the JWT and cannot be
  -- spoofed; SECURITY DEFINER bypasses RLS so this is the only thing
  -- standing between the JWT and the function body.
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'merge_chapters_at: caller user does not match authenticated session'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Input validation
  IF p_keep_index IS NULL OR p_delete_index IS NULL OR p_keep_index < 0 OR p_delete_index < 0 THEN
    RAISE EXCEPTION 'merge_chapters_at: indices must be >= 0';
  END IF;
  IF p_keep_index = p_delete_index THEN
    RAISE EXCEPTION 'merge_chapters_at: keep and delete indices must differ';
  END IF;
  IF p_keep_index >= p_delete_index THEN
    RAISE EXCEPTION 'merge_chapters_at: keep index must be less than delete index (caller must min/max)';
  END IF;
  IF p_merged_title IS NULL OR length(trim(p_merged_title)) = 0 THEN
    RAISE EXCEPTION 'merge_chapters_at: merged_title is required';
  END IF;

  -- Ownership check — defense in depth alongside RLS.
  SELECT user_id INTO v_owner FROM public.books WHERE id = p_book_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'merge_chapters_at: book not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_owner <> p_user_id THEN
    RAISE EXCEPTION 'merge_chapters_at: caller does not own this book'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 1. Replace kept chapter's title + brief; reset prior draft state.
  UPDATE public.book_pages
     SET chapter_title = trim(p_merged_title),
         chapter_brief = COALESCE(NULLIF(trim(p_merged_brief), ''), chapter_brief),
         approved      = false,
         content       = null,
         pull_quote    = null,
         updated_at    = now()
   WHERE book_id = p_book_id
     AND chapter_index = p_keep_index;

  -- 2. Drop the deleted chapter row.
  DELETE FROM public.book_pages
   WHERE book_id = p_book_id
     AND chapter_index = p_delete_index;

  -- 3. Two-phase pull-down: every chapter above p_delete_index slides
  --    one slot left. Park them in 1M+ first so the unique index can't
  --    fire mid-update.
  UPDATE public.book_pages
     SET chapter_index = chapter_index + 1000000
   WHERE book_id = p_book_id
     AND chapter_index > p_delete_index
     AND chapter_index < 99;

  UPDATE public.book_pages
     SET chapter_index = chapter_index - 1000001,
         updated_at    = now()
   WHERE book_id = p_book_id
     AND chapter_index >= 1000000;

  -- Touch the book row so consumers can detect the structural change.
  UPDATE public.books SET updated_at = now() WHERE id = p_book_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_chapters_at(uuid, uuid, int, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_chapters_at(uuid, uuid, int, int, text, text) TO authenticated;


-- swap_chapters_at(p_book_id, p_user_id, p_from_index, p_to_index)
--
-- Exchanges two chapters' positions. NOT a multi-position shift — the
-- chapter at p_to_index moves to p_from_index and vice versa. The
-- callers (currently OutlineStage's STRUCTURE-reorder Apply) treat
-- "reorder" as a swap; if you need a true cascading reorder later,
-- introduce a separate move_chapter_to RPC.
--
-- Three-phase via a 999998 parking slot avoids unique-index violations
-- on (book_id, chapter_index).

CREATE OR REPLACE FUNCTION public.swap_chapters_at(
  p_book_id    uuid,
  p_user_id    uuid,
  p_from_index int,
  p_to_index   int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner    uuid;
  v_temp_idx int := 999998;
  v_from_id  uuid;
  v_to_id    uuid;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'swap_chapters_at: caller user does not match authenticated session'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_from_index IS NULL OR p_to_index IS NULL OR p_from_index < 0 OR p_to_index < 0 THEN
    RAISE EXCEPTION 'swap_chapters_at: indices must be >= 0';
  END IF;
  IF p_from_index = p_to_index THEN
    -- No-op rather than an error — easier for callers.
    RETURN;
  END IF;

  SELECT user_id INTO v_owner FROM public.books WHERE id = p_book_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'swap_chapters_at: book not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_owner <> p_user_id THEN
    RAISE EXCEPTION 'swap_chapters_at: caller does not own this book'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Verify both rows exist before touching anything.
  SELECT id INTO v_from_id FROM public.book_pages
   WHERE book_id = p_book_id AND chapter_index = p_from_index;
  IF v_from_id IS NULL THEN
    RAISE EXCEPTION 'swap_chapters_at: from_index has no chapter';
  END IF;
  SELECT id INTO v_to_id FROM public.book_pages
   WHERE book_id = p_book_id AND chapter_index = p_to_index;
  IF v_to_id IS NULL THEN
    RAISE EXCEPTION 'swap_chapters_at: to_index has no chapter';
  END IF;

  -- 3-step swap
  UPDATE public.book_pages
     SET chapter_index = v_temp_idx, updated_at = now()
   WHERE id = v_from_id;

  UPDATE public.book_pages
     SET chapter_index = p_from_index, updated_at = now()
   WHERE id = v_to_id;

  UPDATE public.book_pages
     SET chapter_index = p_to_index, updated_at = now()
   WHERE id = v_from_id;

  UPDATE public.books SET updated_at = now() WHERE id = p_book_id;
END;
$$;

REVOKE ALL ON FUNCTION public.swap_chapters_at(uuid, uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.swap_chapters_at(uuid, uuid, int, int) TO authenticated;
