// רץ לפני כל JS של פייסבוק - יורט תשובות GraphQL
window.__groupsCapture = new Map();

const origFetch = window.fetch;
window.fetch = async function(...args) {
  const res = await origFetch.apply(this, args);
  try {
    const url = (typeof args[0] === "string" ? args[0] : args[0]?.url) || "";
    if (url.includes("/api/graphql/")) {
      res.clone().text().then((text) => {
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          try { findGroups(JSON.parse(line), window.__groupsCapture); } catch {}
        }
      });
    }
  } catch {}
  return res;
};

function findGroups(obj, map, depth) {
  if (!obj || typeof obj !== "object" || depth > 25) return;
  if (obj.__typename === "Group" && obj.id && obj.name) {
    map.set(obj.id, { fbGroupId: obj.id, name: obj.name });
    return;
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") findGroups(v, map, (depth || 0) + 1);
  }
}
