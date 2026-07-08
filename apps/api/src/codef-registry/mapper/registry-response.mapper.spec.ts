import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CodefRegistryRawResponse } from '../client/codef-registry.client';
import type { CodefRegisterContentItem, CodefRegisterOutput, CodefRegisterSection } from './codef-register-response';
import { UnparseableRegistrationEntryError, mapRegistryResponseToRegisteredRights } from './registry-response.mapper';

const REAL_FIXTURE_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'test',
  'fixtures',
  'codef-registry-real-response.json',
);

function headerRow(columns: string[]): CodefRegisterContentItem {
  return {
    resNumber: '0',
    resType2: '1',
    resDetailList: columns.map((name, index) => ({ resNumber: String(index), resContents: name })),
  };
}

function dataRow(resNumber: string, values: string[]): CodefRegisterContentItem {
  return {
    resNumber,
    resType2: '2',
    resDetailList: values.map((value, index) => ({ resNumber: String(index), resContents: value })),
  };
}

const RIGHTS_HEADER = ['순위번호', '등기목적', '접수정보', '주요등기사항', '대상소유자'];

function rightsSection(rows: CodefRegisterContentItem[]): CodefRegisterSection {
  return { resType: '소유지분을 제외한 소유권에 관한 사항 (갑구)', resType1: '', resContentsList: [headerRow(RIGHTS_HEADER), ...rows] };
}

function nonRightsSection(): CodefRegisterSection {
  return {
    resType: '소유지분현황 (갑구)',
    resType1: '',
    resContentsList: [headerRow(['등기명의인', '(주민)등록번호', '최종지분', '주소', '순위번호'])],
  };
}

function responseWith(sections: CodefRegisterSection[]): CodefRegistryRawResponse {
  const data: CodefRegisterOutput = {
    commIssueCode: '',
    resIssueYN: '1',
    resTotalPageCount: '',
    commStartPageNo: '',
    resEndPageNo: '',
    resWarningMessage: '',
    resOriGinalData: '',
    resAddrList: [],
    resSearchList: [],
    resRegisterEntriesList: [
      {
        resIssueNo: '',
        commUniqueNo: '11032020002242',
        resDocTitle: '등기사항전부증명서',
        resRealty: '[집합건물] 서울특별시 중구 오장동 145-1',
        commCompetentRegistryOffice: '서울중앙지방법원 중부등기소',
        resPublishNo: '',
        resPublishDate: '20260708',
        resPublishRegistryOffice: '',
        resPrecautionsList: [],
        resRegistrationSumList: sections,
        resRegistrationHisList: [],
      },
    ],
  };

  return { result: { code: 'CF-00000', message: '성공' }, data };
}

describe('mapRegistryResponseToRegisteredRights (실제 헤더행+데이터행 표 구조, 2026-07-08 실호출 확인)', () => {
  it('등기목적 컬럼이 없는 구획(소유지분현황 등)은 건너뛴다', () => {
    const result = mapRegistryResponseToRegisteredRights(responseWith([nonRightsSection()]));

    expect(result).toEqual([]);
  });

  it('가압류 행을 청구금액과 함께 PROVISIONAL_SEIZURE로 변환한다', () => {
    const section = rightsSection([
      dataRow('1', ['3', '가압류', '2022년10월18일\n제35763호', '청구금액 금393,374,335 원\n채권자 김민준', '다라기업주식회사']),
    ]);

    const result = mapRegistryResponseToRegisteredRights(responseWith([section]));

    expect(result).toEqual([
      { id: '3', type: 'PROVISIONAL_SEIZURE', receivedDate: '2022-10-18', amount: 393_374_335 },
    ]);
  });

  it('강제경매개시결정처럼 금액 문구가 없는 행은 amount 없이 변환된다', () => {
    const section = rightsSection([
      dataRow('1', ['6', '강제경매개시결정', '2023년9월21일\n제35874호', '채권자 이서연', '다라기업주식회사']),
    ]);

    const result = mapRegistryResponseToRegisteredRights(responseWith([section]));

    expect(result).toEqual([{ id: '6', type: 'AUCTION_COMMENCEMENT', receivedDate: '2023-09-21' }]);
  });

  it('소유권보존·소유권이전 등 WP-03 범위 밖 등기목적은 결과에서 제외된다', () => {
    const section = rightsSection([
      dataRow('1', ['1', '소유권보존|&신탁&', '2020년9월10일\n제33649호', '', '가나부동산신탁주식회사']),
    ]);

    expect(mapRegistryResponseToRegisteredRights(responseWith([section]))).toEqual([]);
  });

  it('접수정보에서 날짜를 추출할 수 없는 행은 명시적 오류를 던진다', () => {
    const section = rightsSection([dataRow('1', ['3', '가압류', '날짜 형식이 아닌 텍스트', '', ''])]);

    expect(() => mapRegistryResponseToRegisteredRights(responseWith([section]))).toThrow(
      UnparseableRegistrationEntryError,
    );
  });

  it('2026-07-08 실호출로 캡처한 실제 등기부 응답을 정확히 변환한다 (개인정보는 익명화됨)', () => {
    const realResponse: CodefRegistryRawResponse = JSON.parse(readFileSync(REAL_FIXTURE_PATH, 'utf-8'));

    const result = mapRegistryResponseToRegisteredRights(realResponse);

    expect(result).toEqual([
      { id: '3', type: 'PROVISIONAL_SEIZURE', receivedDate: '2022-10-18', amount: 393_374_335 },
      { id: '4', type: 'PROVISIONAL_SEIZURE', receivedDate: '2023-05-23', amount: 726_313_737 },
      { id: '5', type: 'PROVISIONAL_SEIZURE', receivedDate: '2023-07-28', amount: 425_906_717 },
      { id: '6', type: 'AUCTION_COMMENCEMENT', receivedDate: '2023-09-21' },
    ]);
  });
});
