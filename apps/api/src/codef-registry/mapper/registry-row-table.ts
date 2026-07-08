// 등기부 표 구조 해석 — 실제 응답(2026-07-08 실호출 확인)은 각 구획(갑구/을구 등)의
// resContentsList가 [헤더행(resType2="1"), 데이터행(resType2="2")...]로 구성되고, 데이터행의
// resDetailList는 resNumber(열 위치)로 헤더행과 같은 위치의 컬럼명에 대응한다.
import type { CodefRegisterContentItem, CodefRegisterSection } from './codef-register-response';

const HEADER_ROW_MARKER = '1';

export interface RegistryRow {
  columns: Map<string, string>;
}

function buildColumnNamesByIndex(headerRow: CodefRegisterContentItem): Map<number, string> {
  const names = new Map<number, string>();
  for (const detail of headerRow.resDetailList) {
    names.set(Number(detail.resNumber), detail.resContents);
  }
  return names;
}

/** 이 구획의 헤더에 해당 컬럼명이 있는지 — "등기목적" 컬럼 유무로 권리 표인지 아닌지(소유지분현황·개별공시지가 등) 판별한다. */
export function hasColumn(section: CodefRegisterSection, columnName: string): boolean {
  const headerRow = section.resContentsList.find((item) => item.resType2 === HEADER_ROW_MARKER);
  return headerRow?.resDetailList.some((detail) => detail.resContents === columnName) ?? false;
}

export function parseRegistryRows(section: CodefRegisterSection): RegistryRow[] {
  const headerRow = section.resContentsList.find((item) => item.resType2 === HEADER_ROW_MARKER);
  if (!headerRow) {
    return [];
  }
  const columnNames = buildColumnNamesByIndex(headerRow);

  return section.resContentsList
    .filter((item) => item.resType2 !== HEADER_ROW_MARKER)
    .map((row) => {
      const columns = new Map<string, string>();
      for (const detail of row.resDetailList) {
        const name = columnNames.get(Number(detail.resNumber));
        if (name) {
          columns.set(name, detail.resContents);
        }
      }
      return { columns };
    });
}

export function getColumn(row: RegistryRow, ...candidateNames: string[]): string | null {
  for (const name of candidateNames) {
    const value = row.columns.get(name);
    if (value !== undefined) {
      return value;
    }
  }
  return null;
}
