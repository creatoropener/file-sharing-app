import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, formatSpeed } from '@/lib/utils/format';

test('formatBytes and formatSpeed produce human-readable units with correct precision', async () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(102400), '100 KB');
  assert.equal(formatBytes(1048576), '1.0 MB');
  assert.equal(formatBytes(1073741824), '1.0 GB');
  assert.equal(formatSpeed(1536), '1.5 KB/s');
});
