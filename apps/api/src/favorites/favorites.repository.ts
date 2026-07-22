// 관심 물건 리포지토리 — favorite 테이블을 pg 드라이버로 직접 다룬다 (ORM 미사용, 기존 패턴 준수)
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';

export const FAVORITES_PG_POOL = Symbol('FAVORITES_PG_POOL');

export interface FavoriteRecord {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
  createdAt: Date;
}

interface FavoriteRow extends QueryResultRow {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
  createdAt: Date;
}

@Injectable()
export class FavoritesRepository {
  constructor(@Inject(FAVORITES_PG_POOL) private readonly pool: Pool) {}

  async findByUser(userId: string): Promise<FavoriteRecord[]> {
    const result = await this.pool.query<FavoriteRow>(
      `SELECT court_office_code AS "courtOfficeCode", case_no AS "caseNo", item_no AS "itemNo",
              created_at AS "createdAt"
       FROM favorite WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  /** 이미 등록돼 있으면 아무 것도 하지 않는다 — 재등록이 안전하게 멱등하도록 (AGENTS.md 규칙 10) */
  async add(userId: string, courtOfficeCode: string, caseNo: string, itemNo: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO favorite (user_id, court_office_code, case_no, item_no)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, court_office_code, case_no, item_no) DO NOTHING`,
      [userId, courtOfficeCode, caseNo, itemNo],
    );
  }

  /** 없는 항목을 지워도 에러 없이 통과한다 — 해제도 멱등하게 */
  async remove(userId: string, courtOfficeCode: string, caseNo: string, itemNo: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM favorite WHERE user_id = $1 AND court_office_code = $2 AND case_no = $3 AND item_no = $4`,
      [userId, courtOfficeCode, caseNo, itemNo],
    );
  }
}
