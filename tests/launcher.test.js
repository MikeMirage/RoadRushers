import test from 'node:test';
import assert from 'node:assert/strict';
import { validateArchiveEntries } from '../scripts/launcher.mjs';

test('downloaded source ZIPs retain one version directory', () => {
  assert.equal(validateArchiveEntries('RoadRushers-123/\nRoadRushers-123/index.html\nRoadRushers-123/src/main.js\n'), 'RoadRushers-123');
});

test('version ZIPs cannot overwrite files outside their extracted directory', () => {
  for (const listing of [
    '',
    '/tmp/overwrite\n',
    'RoadRushers-123/\nRoadRushers-123/../../README.md\n',
    'RoadRushers-123/\nother-version/index.html\n',
    'RoadRushers-123/\nRoadRushers-123/..\\..\\README.md\n',
  ]) assert.throws(() => validateArchiveEntries(listing), /estructura válida/);
});
