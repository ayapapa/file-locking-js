const fs = require("fs");
const path = require("path");

const docsDir = path.join(__dirname, "..", "docs");
const from = path.join(docsDir, "README.md");
const to = path.join(docsDir, "api.md");

if (fs.existsSync(from)) {
  fs.renameSync(from, to);
  console.log("Renamed README.md to api.md");
} else {
  console.log("README.md was not found");
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && fullPath.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

const mdFiles = walk(docsDir);

for (const file of mdFiles) {
  let content = fs.readFileSync(file, "utf8");

  const replaced = content
    .replace(/\]\(\.\/README\.md\)/g, "](./api.md)")
    .replace(/\]\(README\.md\)/g, "](api.md)")
    .replace(/\]\(\.\.\/README\.md\)/g, "](../api.md)");

  if (content !== replaced) {
    fs.writeFileSync(file, replaced, "utf8");
    console.log(`Updated links in: ${path.relative(docsDir, file)}`);
  }
}
