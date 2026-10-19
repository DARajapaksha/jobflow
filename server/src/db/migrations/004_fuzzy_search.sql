-- Typo-tolerant job search.
--   fuzzystrmatch  edit distance: finds "develper" for "developer", "desinger" for "designer", "foll stack" for "Full Stack"
--   pg_trgm        trigram similarity: used to put closer matches first
-- Both are standard PostgreSQL extensions (also available on Neon) that a database owner may install.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- jf_norm: lower case, with spaces and punctuation removed: "Full-Stack Dev." -> "fullstackdev"
CREATE OR REPLACE FUNCTION jf_norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(regexp_replace(t, '[\s\-_./,()&+:;''"!?]+', '', 'g'))
$$;

-- jf_words: lower case, with each run of spaces/punctuation turned into one space: "Full-Stack Dev." -> "full stack dev"
CREATE OR REPLACE FUNCTION jf_words(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(btrim(regexp_replace(t, '[\s\-_./,()&+:;''"!?]+', ' ', 'g')))
$$;

-- jf_close_phrase: is the (already normalised) query within k edits of some run of up to 4 consecutive words of
-- doc, written together? "fullstack" and "foll stack" are close to the words "Full Stack" in "Full Stack Developer"
-- and to the single word in "Fullstack Engineer". Precise on purpose: unlike plain trigram overlap it does not
-- match "reactaccountant" to "Junior Accountant".
CREATE OR REPLACE FUNCTION jf_close_phrase(qn text, doc text, k int) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM (SELECT string_to_array(jf_words(doc), ' ') AS w) t,
         generate_series(1, coalesce(cardinality(t.w), 0)) AS i,
         generate_series(0, 3) AS n
    WHERE i + n <= cardinality(t.w)
      AND levenshtein_less_equal(qn, array_to_string(t.w[i:i + n], ''), k) <= k
  )
$$;
