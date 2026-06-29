async function init() {
  const { apiToken, userName, userEmail } = await chrome.storage.local.get(["apiToken", "userName", "userEmail"]);

  if (apiToken && userName) {
    document.getElementById("dot").className = "dot dot-green";
    document.getElementById("statusText").textContent = "מחובר ופעיל";
    document.getElementById("statusSub").textContent = "בודק פוסטים כל 30 שניות";
    document.getElementById("userBox").style.display = "block";
    document.getElementById("userName").textContent = userName;
    document.getElementById("userEmail").textContent = userEmail || "";
    document.getElementById("footer").textContent = "פרסום ברקע פעיל";
  } else {
    document.getElementById("dot").className = "dot dot-yellow";
    document.getElementById("statusText").textContent = "לא מחובר";
    document.getElementById("statusSub").textContent = "היכנס לאתר כדי להתחיל";
    document.getElementById("footer").innerHTML = '<a href="https://matara-publisher.vercel.app/login" target="_blank">לחץ כאן להתחברות →</a>';
  }
}

init();
