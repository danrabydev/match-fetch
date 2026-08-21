const [major, minor] = process.versions.node.split(".").map(Number);
const ok = major > 22 || (major === 22 && minor >= 18);
if (!ok) {
  console.error(
    `tsdown needs Node 22.18+ (this process is ${process.version}).\n` +
      `nvm use 22\n` +
      `then retry npm publish --access public`,
  );
  process.exit(1);
}
