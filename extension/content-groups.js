// Injected at document_start on groups/joins - intercept all network data
window.__groupsCapture = new Map();

function parseGroups(text) {
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try { walk(JSON.parse(line), 0); } catch {}
  }
}

function walk(obj, depth) {
  if (!obj || typeof obj !== "object" || depth > 30) return;
  const t = obj.__typename;
  if (t === "Group" || t === "CometGroup" || t === "GroupPage") {
    if (obj.id && obj.name && typeof obj.name === "string") {
      window.__groupsCapture.set(obj.id, { fbGroupId: obj.id, name: obj.name });
      return;
    }
  }
  if (obj.url && typeof obj.url === "string" && obj.name && typeof obj.name === "string") {
    const m = obj.url.match(/facebook\.com\/groups\/([^/?#\s]+)/);
    const skip = new Set(["feed", "joins", "joined", "discover", "create", "your_posts", "explore", "membership", "permalink"]);
    if (m && !skip.has(m[1]) && /^[\w.-]{2,}$/.test(m[1])) {
      window.__groupsCapture.set(m[1], { fbGroupId: m[1], name: obj.name });
    }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") walk(v, depth + 1);
  }
}

// Intercept fetch
const origFetch = window.fetch;
window.fetch = async function(...args) {
  const res = await origFetch.apply(this, args);
  try {
    const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
    if (url.includes("/api/graphql")) res.clone().text().then(parseGroups).catch(() => {});
  } catch {}
  return res;
};

// Intercept XHR
const origOpen = XMLHttpRequest.prototype.open;
const origSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function(m, url) {
  this._url = url;
  return origOpen.apply(this, arguments);
};
XMLHttpRequest.prototype.send = function() {
  if (String(this._url || "").includes("/api/graphql")) {
    this.addEventListener("load", function() {
      try { parseGroups(this.responseText); } catch {}
    });
  }
  return origSend.apply(this, arguments);
};
