import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBulkLot } from './bulk-lot';

test('사건 하나가 목적물 여럿을 일괄매각하면 묶음으로 본다', () => {
  assert.equal(
    isBulkLot([
      { caseNo: '2025타경859', bulkSale: true },
      { caseNo: '2025타경859', bulkSale: true },
    ]),
    true,
  );
});

test('일괄매각 표시가 없으면 각자 팔리는 물건이라 묶음이 아니다', () => {
  assert.equal(
    isBulkLot([
      { caseNo: '2025타경859', bulkSale: true },
      { caseNo: '2025타경859', bulkSale: false },
    ]),
    false,
  );
});

test('같은 좌표라도 사건이 다르면 가격을 한 번만 적을 수 없다', () => {
  assert.equal(
    isBulkLot([
      { caseNo: '2025타경859', bulkSale: true },
      { caseNo: '2025타경860', bulkSale: true },
    ]),
    false,
  );
});

test('물건이 하나뿐이면 묶음이 아니다 — 그 물건의 가격이 곧 자기 가격이다', () => {
  assert.equal(isBulkLot([{ caseNo: '2025타경859', bulkSale: true }]), false);
  assert.equal(isBulkLot([]), false);
});
