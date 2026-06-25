const { Service } = require("node-windows");
const path = require("path");

const svc = new Service({
  name: "Matara Publisher",
  description: "Matara Publisher - Local automation server",
  script: path.join(__dirname, "local-server.js"),
  nodeOptions: [],
  workingDirectory: __dirname,
  allowServiceLogon: true,
});

svc.on("install", () => {
  console.log("✅ Service installed! Starting...");
  svc.start();
});

svc.on("start", () => {
  console.log("✅ Matara Publisher service is running!");
  console.log("The server will now start automatically with Windows.");
});

svc.on("error", (err) => {
  console.error("❌ Error:", err);
});

svc.install();
