const { Service } = require("node-windows");
const path = require("path");

const svc = new Service({
  name: "Matara Publisher",
  script: path.join(__dirname, "local-server.js"),
});

svc.on("uninstall", () => {
  console.log("✅ Service removed.");
});

svc.uninstall();
