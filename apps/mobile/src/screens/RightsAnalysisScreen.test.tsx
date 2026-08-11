// 권리분석 화면 테스트 — 명세서 미수집(404)과 "인수할 권리 없음"을 구분해 렌더하는지,
// 실부담 시나리오·일괄매각·직접 입력 경로가 실데이터대로 그려지는지 검증한다.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { fetchAffordability, fetchNoticeAnalysis } from '../api/auctionItems';
import type { Affordability } from '../lib/affordability';
import type { AnalyzedTenant, NoticeAnalysis } from '../lib/notice-analysis';
import { RightsAnalysisScreen } from './RightsAnalysisScreen';

jest.mock('../api/auctionItems', () => ({
  fetchNoticeAnalysis: jest.fn(),
  fetchAffordability: jest.fn(),
}));

const mockedFetchNoticeAnalysis = fetchNoticeAnalysis as jest.Mock;
const mockedFetchAffordability = fetchAffordability as jest.Mock;

const PARAMS = {
  courtOfficeCode: 'B000210',
  caseNo: '2022타경101244',
  itemNo: '1',
};

function tenant(
  overrides: Partial<AnalyzedTenant> & Pick<AnalyzedTenant, 'tenantSeq'>,
): AnalyzedTenant {
  return {
    sourceKinds: ['권리신고'],
    occupiedPart: '202호',
    moveInDate: '2020-07-29',
    fixedDate: '2023-12-20',
    depositAmount: 50_000_000,
    demandedDistribution: true,
    demandedDistributionDate: '2024-10-25',
    possessionRightDate: '2020-07-30',
    hasPriority: true,
    distributionDemandEffective: true,
    assumption: 'ASSUMED_AMOUNT_UNKNOWN',
    assumedAmount: null,
    ...overrides,
  };
}

function analysis(overrides: Partial<NoticeAnalysis> = {}): NoticeAnalysis {
  return {
    documentDate: '2025-01-10',
    baselineRaw: '2024.02.19. 압류',
    baselineDate: '2024-02-19',
    distributionDemandDeadline: '2024-10-28',
    assumedRightsKind: 'NONE',
    riskFlags: ['LIEN_CLAIM'],
    tenants: [
      tenant({
        tenantSeq: 1,
        assumption: 'ASSUMED_FULL',
        assumedAmount: 50_000_000,
      }),
      tenant({
        tenantSeq: 2,
        occupiedPart: null,
        assumption: 'NOT_ASSUMED',
        assumedAmount: 0,
      }),
    ],
    source: 'NOTICE_ONLY',
    ...overrides,
  };
}

function affordability(overrides: Partial<Affordability> = {}): Affordability {
  return {
    appraisalAmount: 300_000_000,
    minimumSalePrice: 192_000_000,
    bulkSale: false,
    usageName: '다세대',
    assumedTotal: 50_000_000,
    assumedIsLowerBound: false,
    comparableSales: {
      usage: '다세대',
      sampleCount: 12,
      rateP25: 60,
      rateMedian: 70,
      rateP75: 80,
    },
    scenarios: [
      {
        kind: 'MINIMUM_PRICE',
        bidPrice: 192_000_000,
        totalBurden: 242_000_000,
        totalWithExtras: { min: 250_000_000, max: 260_000_000 },
        appraisalRatio: { min: 83.3, max: 86.7 },
        extras: [],
        unknownItems: ['UNPAID_MAINTENANCE_FEE'],
      },
      {
        kind: 'COMPARABLE_MEDIAN',
        bidPrice: 210_000_000,
        totalBurden: 260_000_000,
        totalWithExtras: { min: 268_000_000, max: 278_000_000 },
        appraisalRatio: { min: 89.3, max: 92.7 },
        extras: [],
        unknownItems: ['UNPAID_MAINTENANCE_FEE'],
      },
    ],
    referencePrice: 'APPRAISAL',
    source: 'NOTICE_ONLY',
    ...overrides,
  };
}

// 가장 크게 읽히는 값만 본다 — 보증금 "50,000,000원"이나 요약칩 "금액 확인 필요"에
// 부분 일치하지 않도록 라벨에 이어 붙은 자리로 범위를 좁힌다.
const HEADLINE_ZERO = /매수인이 인수하는 보증금\s+0원/;
const HEADLINE_UNCONFIRMED = /매수인이 인수하는 보증금\s+확인 필요/;

let mounted: TestRenderer.ReactTestRenderer | undefined;

async function renderScreen() {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    renderer = TestRenderer.create(
      <RightsAnalysisScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: PARAMS } as any}
      />,
    );
  });
  if (!renderer) throw new Error('renderer not created');
  mounted = renderer;
  return renderer;
}

// 렌더 트리에 순환 참조가 있을 수 있어 JSON.stringify 대신 화면의 글자만 모은다.
function screenText(renderer: TestRenderer.ReactTestRenderer): string {
  const parts: string[] = [];
  const visit = (node: TestRenderer.ReactTestInstance) => {
    for (const child of node.children) {
      if (typeof child === 'string') parts.push(child);
      else visit(child);
    }
  };
  visit(renderer.root);
  return parts.join(' ');
}

describe('RightsAnalysisScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      mounted?.unmount();
    });
    mounted = undefined;
  });

  it('명세서를 아직 못 받았으면(404) "확인되지 않음"으로 적고 인수할 권리 없음과 구분한다', async () => {
    mockedFetchNoticeAnalysis.mockResolvedValue(null);
    mockedFetchAffordability.mockResolvedValue(null);

    const rendered = screenText(await renderScreen());

    expect(rendered).toContain('아직 매각물건명세서를 받지 못했어요.');
    expect(rendered).toContain('확인되지 않았다는 뜻이에요');
    expect(rendered).not.toContain('인수할 권리 없음');
  });

  it('사건키로 두 API를 부르고 인수 보증금·임차인·최선순위를 실데이터로 그린다', async () => {
    mockedFetchNoticeAnalysis.mockResolvedValue(analysis());
    mockedFetchAffordability.mockResolvedValue(affordability());

    const rendered = screenText(await renderScreen());

    expect(mockedFetchNoticeAnalysis).toHaveBeenCalledWith(PARAMS);
    expect(mockedFetchAffordability).toHaveBeenCalledWith(PARAMS);
    expect(rendered).toContain('50,000,000원');
    expect(rendered).toContain('최저가');
    expect(rendered).toContain('192,000,000원');
    expect(rendered).toContain('202호');
    expect(rendered).toContain('점유자 2');
    expect(rendered).toContain('보증금 전액 인수');
    expect(rendered).toContain('인수 안 함');
    expect(rendered).toContain('2024.02.19. 압류');
    expect(rendered).toContain('배당요구종기 2024-10-28');
    expect(rendered).toContain('유치권 신고');
    expect(rendered).toContain('등기부는 아직 연동하지 않아서');
  });

  it('평가어를 쓰지 않는다 (D-011)', async () => {
    mockedFetchNoticeAnalysis.mockResolvedValue(analysis());
    mockedFetchAffordability.mockResolvedValue(affordability());

    const rendered = screenText(await renderScreen());

    for (const word of ['추천', '안전', '위험', '유리', '권유']) {
      expect(rendered).not.toContain(word);
    }
  });

  it('확정 금액이 없고 미확정만 있으면 0원 대신 "확인 필요"를 크게 쓴다', async () => {
    mockedFetchNoticeAnalysis.mockResolvedValue(
      analysis({ tenants: [tenant({ tenantSeq: 1 })] }),
    );
    mockedFetchAffordability.mockResolvedValue(null);

    const rendered = screenText(await renderScreen());

    expect(rendered).toMatch(HEADLINE_UNCONFIRMED);
    expect(rendered).not.toMatch(HEADLINE_ZERO);
    expect(rendered).toContain('등기부의 권리와 채권액이 있어야');
  });

  it('전원 인수 대상이 아니면 0원이 사실이라 그대로 쓴다', async () => {
    mockedFetchNoticeAnalysis.mockResolvedValue(
      analysis({
        tenants: [
          tenant({ tenantSeq: 1, assumption: 'NOT_ASSUMED', assumedAmount: 0 }),
        ],
      }),
    );
    mockedFetchAffordability.mockResolvedValue(null);

    const rendered = screenText(await renderScreen());

    expect(rendered).toMatch(HEADLINE_ZERO);
    expect(rendered).not.toMatch(HEADLINE_UNCONFIRMED);
  });

  it('실부담 시나리오를 감정가 대비 %와 함께 그리고 감정가는 시세가 아니라고 밝힌다', async () => {
    mockedFetchNoticeAnalysis.mockResolvedValue(analysis());
    mockedFetchAffordability.mockResolvedValue(affordability());

    const rendered = screenText(await renderScreen());

    expect(rendered).toContain('결국 얼마가 드나');
    expect(rendered).toContain('이번 최저가로 낙찰되면');
    expect(rendered).toContain('유사 물건 중간 가격대면');
    expect(rendered).toContain('2억 5,000만~2억 6,000만');
    expect(rendered).toContain('감정가의 83~87%');
    expect(rendered).toContain('감정가는 시세가 아니라서');
    expect(rendered).toContain('낙찰 12건의 실측 분포');
  });

  it('인수액이 하한이면 총부담 뒤에 "이상"을 붙인다', async () => {
    mockedFetchNoticeAnalysis.mockResolvedValue(analysis());
    mockedFetchAffordability.mockResolvedValue(
      affordability({ assumedIsLowerBound: true }),
    );

    expect(screenText(await renderScreen())).toContain('이상');
  });

  it('일괄매각이면 시나리오를 그리지 않고 이유를 적는다', async () => {
    mockedFetchNoticeAnalysis.mockResolvedValue(analysis());
    mockedFetchAffordability.mockResolvedValue(
      affordability({ bulkSale: true, scenarios: [] }),
    );

    const rendered = screenText(await renderScreen());

    expect(rendered).toContain('일괄매각 물건이라 최저가가 묶음 전체 값이에요');
    expect(rendered).not.toContain('이번 최저가로 낙찰되면');
  });

  it('실부담 조회가 실패해도 권리분석 본문은 막지 않는다', async () => {
    mockedFetchNoticeAnalysis.mockResolvedValue(analysis());
    mockedFetchAffordability.mockRejectedValue(new Error('network'));

    const rendered = screenText(await renderScreen());

    expect(rendered).toContain('2024.02.19. 압류');
    expect(rendered).not.toContain('결국 얼마가 드나');
  });

  it('권리분석 조회가 실패하면 다시 시도로 재조회한다', async () => {
    mockedFetchNoticeAnalysis.mockRejectedValueOnce(new Error('network'));
    mockedFetchAffordability.mockResolvedValue(null);

    const renderer = await renderScreen();
    expect(screenText(renderer)).toContain('권리분석을 불러오지 못했어요.');

    mockedFetchNoticeAnalysis.mockResolvedValue(analysis());
    const retry = renderer.root
      .findAll(node => node.props.accessibilityRole === 'button')
      .at(0);
    await act(async () => {
      retry?.props.onPress();
    });

    expect(screenText(renderer)).toContain('2024.02.19. 압류');
  });

  it('입찰가를 직접 넣으면 그 값으로 다시 물어 CUSTOM 시나리오를 보여준다', async () => {
    mockedFetchNoticeAnalysis.mockResolvedValue(analysis());
    mockedFetchAffordability.mockResolvedValue(affordability());

    const renderer = await renderScreen();

    const input = renderer.root
      .findAll(node => node.props.accessibilityLabel === '입찰가 (원)')
      .at(0);
    await act(async () => {
      input?.props.onChangeText('220,000,000');
    });

    mockedFetchAffordability.mockResolvedValue(
      affordability({
        scenarios: [
          {
            kind: 'CUSTOM',
            bidPrice: 220_000_000,
            totalBurden: 270_000_000,
            totalWithExtras: { min: 280_000_000, max: 290_000_000 },
            appraisalRatio: { min: 93.3, max: 96.7 },
            extras: [],
            unknownItems: [],
          },
        ],
      }),
    );
    const button = renderer.root
      .findAll(node => node.props.accessibilityLabel === '입찰가로 총부담 계산')
      .at(0);
    await act(async () => {
      button?.props.onPress();
    });

    expect(mockedFetchAffordability).toHaveBeenLastCalledWith(
      PARAMS,
      220_000_000,
    );
    const rendered = screenText(renderer);
    expect(rendered).toContain('220,000,000원');
    expect(rendered).toContain('인수·취득세·등기·명도비까지 총');
    expect(rendered).toContain('2억 8,000만~2억 9,000만');
  });
});
