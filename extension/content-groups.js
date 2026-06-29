// רץ לפני כל JS של פייסבוק - יורט fetch + XHR כדי לתפוס נתוני קבוצות
window.__groupsCapture = new Map();

function findGroups(obj, map, depth) {
  if (!obj || typeof obj !== "object" || depth > 30) return;
  const t = obj.__typename || "";
  if ((t === "Group" || t === "CometGroup" || t === "GroupPage") && obj.id && obj.name) {
    map.set(obj.id, { fbGroupId: obj.id, name: obj.name });
    return;
  }
  if (obj.url && typeof obj.url === "string" && obj.url.includes("/groups/") && obj.name && typeof obj.name === "string") {
    const m = obj.url.match(/facebook\.com\/groups\/([^/?#\s]+)/);
    if (m && m[1] !== "feed" && m[1] !== "joins") {
      map.set(m[1], { fbGroupId: m[1], name: obj.name });
    }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") findGroups(v, map, depth + 1);
  }
}

function processGraphQL(text) {
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try { findGroups(JSON.parse(line), window.__groupsCapture, 0); } catch {}
  }
}

// יירוט fetch
const origFetch = window.fetch;
window.fetch = async function(...args) {
  const res = await origFetch.apply(this, args);
  try {
    const url = (typeof args[0] === "string" ? args[0] : args[0]?.url) || "";
    if (url.includes("/api/graphql")) {
      res.clone().text().then(processGraphQL).catch(() => {});
    }
  } catch {}
  return res;
};

// יירוט XHR
const origOpen = XMLHttpRequest.prototype.open;
const origSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function(method, url) {
  this._captureUrl = url;
  return origOpen.apply(this, arguments);
};
XMLHttpRequest.prototype.send = function() {
  if (this._captureUrl && String(this._captureUrl).includes("/api/graphql")) {
    this.addEventListener("load", function() {
      try { processGraphQL(this.responseText); } catch {}
    });
  }
  return origSend.apply(this, arguments);
};
