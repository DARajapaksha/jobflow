// Builds "col = $n" pairs for a dynamic UPDATE from a fixed map of allowed fields.
// Column names come from the map, never from user input; values are always parameters.
export function buildSet(fields, columns, startIndex = 1) {
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(columns)) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      sets.push(`${column} = $${startIndex + params.length - 1}`);
    }
  }
  return { sets, params };
}
