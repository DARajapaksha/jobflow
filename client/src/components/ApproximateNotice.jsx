// Shown above the results when none of them matches the search exactly, so close matches never look like a mistake.
export default function ApproximateNotice({ query }) {
  return (
    <p role="status" className="mb-3 text-ink-soft">
      No exact matches for “{query}”. Showing the closest jobs instead.
    </p>
  );
}
