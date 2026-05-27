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
