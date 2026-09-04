const fs = require("fs");
const path = require("path");

const from = path.join(__dirname, "..", "docs", "README.md");
const to = path.join(__dirname, "..", "docs", "api.md");

if (fs.existsSync(from)) {
  fs.renameSync(from, to);
  console.log("Renamed README.md to api.md");
} else {
  console.log("README.md was not found");
}
