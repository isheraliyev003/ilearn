const htmlEntityMap: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#34;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&#x2F;": "/",
  "&#96;": "`",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&amp;|&lt;|&gt;|&quot;|&#34;|&#39;|&#x27;|&#x2F;|&#96;/g,
    (match) => htmlEntityMap[match] ?? match,
  );
}
