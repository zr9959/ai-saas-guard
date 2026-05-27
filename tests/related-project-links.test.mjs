import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), "utf8");
}

test("README points developer users to relevant TIYBAI tools without broad cross-promotion", () => {
  const readme = read("README.md");

  assert.match(readme, /Built by \[TIYBAI\]\(https:\/\/www\.tiybai\.com\/\)/);
  assert.match(readme, /https:\/\/www\.tiybai\.com\/en\/tools\)/);
  assert.match(readme, /https:\/\/www\.tiybai\.com\/en\/tools\/developer\/json-formatter/);
  assert.match(readme, /https:\/\/www\.tiybai\.com\/en\/tools\/developer\/jwt-decoder/);
  assert.match(readme, /https:\/\/www\.tiybai\.com\/en\/tools\/developer\/url-encoder/);
  assert.match(readme, /https:\/\/www\.tiybai\.com\/en\/tools\/ai\/metadata-generator/);
  assert.match(readme, /https:\/\/plugin\.tiybai\.com\//);
});

test("package metadata includes TIYBAI and launch-risk discovery keywords", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert.match(packageJson.description, /TIYBAI/);
  assert.ok(packageJson.keywords.includes("tiybai"));
  assert.ok(packageJson.keywords.includes("launch-risk"));
});

test("repository runs a remote read-only cross-project discovery check", () => {
  const workflow = read(".github/workflows/cross-project-discovery.yml");
  const script = read("scripts/cross-project-discovery-check.mjs");
  const packageJson = JSON.parse(read("package.json"));

  assert.match(workflow, /name: Cross-Project Discovery/);
  assert.match(workflow, /cron: "0 0 \* \* \*"/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /node scripts\/cross-project-discovery-check\.mjs/);
  assert.doesNotMatch(workflow, /secrets\./);

  assert.equal(packageJson.scripts["cross-project:check"], "node scripts/cross-project-discovery-check.mjs");
  assert.match(script, /readsPublicEndpointsOnly: true/);
  assert.match(script, /usesReddit: false/);
  assert.match(script, /https:\/\/git\.tiybai\.com\//);
  assert.match(script, /https:\/\/shop\.tiybai\.com\/sitemap\.xml/);
});
