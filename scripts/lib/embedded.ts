// Reads the JSON that some job sites embed in their HTML search pages
// (InfoJobs and Indeed), so we do not have to parse the visible HTML.
// Both helpers return null when the marker is missing, for example when the
// site answered with a captcha page instead of the search results.

// After `marker` comes a JavaScript string literal holding JSON, as in
//   window.__INITIAL_PROPS__ = JSON.parse("{\"offers\":[...]}")
// Returns the parsed JSON.
export function jsonFromStringLiteral(html: string, marker: string): unknown {
  const at = html.indexOf(marker);
  if (at === -1) return null;
  const start = html.indexOf('"', at + marker.length);
  if (start === -1) return null;
  let end = start + 1;
  while (end < html.length && html[end] !== '"') end += html[end] === "\\" ? 2 : 1;
  if (end >= html.length) return null;
  // A JavaScript literal may escape a single quote, which JSON does not allow.
  const literal = html.slice(start, end + 1).replace(/\\'/g, "'");
  try {
    return JSON.parse(JSON.parse(literal) as string);
  } catch {
    return null;
  }
}

// After `marker` comes a JSON object, as in
//   window.mosaic.providerData["mosaic-provider-jobcards"]={"metaData":...};
// Finds where the object ends by counting braces outside strings.
export function jsonObjectAfter(html: string, marker: string): unknown {
  const at = html.indexOf(marker);
  if (at === -1) return null;
  const start = html.indexOf("{", at + marker.length);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
