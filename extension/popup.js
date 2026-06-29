const API_BASE = "https://matara-publisher.vercel.app";

async function checkConnection(token) {
  try {
    const res = await fetch(`${API_BASE}/api/extension/jobs?token=${token}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

async function init() {
  const { apiToken } = await chrome.storage.local.get("apiToken");
  if (apiToken) {
    const user = await checkConnection(apiToken);
    if (user) showConnected(user);
    else showDisconnected();
  }
}

function showConnected(user) {
  document.getElementById("statusBadge").className = "status-badge status-connected";
  document.getElementById("dot").className = "dot dot-green";
  document.getElementById("statusText").textContent = "מחובר ופעיל";
  document.getElementById("userInfo").style.display = "block";
  document.getElementById("userName").textContent = user.name;
  document.getElementById("userEmail").textContent = user.email;
  document.getElementById("tokenSection").style.display = "none";
  document.getElementById("connectedSection").style.display = "block";
}

function showDisconnected() {
  document.getElementById("statusBadge").className = "status-badge status-disconnected";
  document.getElementById("dot").className = "dot dot-red";
  document.getElementById("statusText").textContent = "לא מחובר";
  document.getElementById("userInfo").style.display = "none";
  document.getElementById("tokenSection").style.display = "block";
  document.getElementById("connectedSection").style.display = "none";
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  const token = document.getElementById("tokenInput").value.trim();
  if (!token) return;

  document.getElementById("saveBtn").textContent = "בודק...";
  document.getElementById("error").textContent = "";

  const user = await checkConnection(token);
  if (user) {
    await chrome.storage.local.set({ apiToken: token });
    showConnected(user);
  } else {
    document.getElementById("error").textContent = "קוד שגוי - בדוק שהעתקת נכון";
    document.getElementById("saveBtn").textContent = "התחבר";
  }
});

document.getElementById("disconnectBtn")?.addEventListener("click", async () => {
  await chrome.storage.local.remove("apiToken");
  showDisconnected();
});

init();
