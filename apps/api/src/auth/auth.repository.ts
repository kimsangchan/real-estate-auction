// 인증 리포지토리 — app_user·refresh_token 테이블을 pg 드라이버로 직접 다룬다 (ORM 미사용, 기존 패턴 준수)
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient, QueryResultRow } from 'pg';

export const AUTH_PG_POOL = Symbol('AUTH_PG_POOL');

/** 트랜잭션 안에서도, 풀에서 바로도 실행 가능한 최소 쿼리 실행기 — Pool·PoolClient 둘 다 구조적으로 만족한다 */
export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface AppUserRecord {
  id: string;
  provider: string;
  providerUserId: string;
  nickname: string;
  createdAt: Date;
}

interface AppUserRow extends QueryResultRow {
  id: string;
  provider: string;
  providerUserId: string;
  nickname: string;
  createdAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

interface RefreshTokenRow extends QueryResultRow {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface InsertRefreshTokenParams {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

@Injectable()
export class AuthRepository {
  constructor(@Inject(AUTH_PG_POOL) private readonly pool: Pool) {}

  /** BEGIN/COMMIT/ROLLBACK을 감싼 트랜잭션 실행기 — 리프레시 토큰 회전처럼 여러 단계인 변경에 쓴다 (AGENTS.md 규칙 9) */
  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async upsertUser(provider: string, providerUserId: string, nickname: string): Promise<AppUserRecord> {
    const result = await this.pool.query<AppUserRow>(
      `INSERT INTO app_user (provider, provider_user_id, nickname)
       VALUES ($1, $2, $3)
       ON CONFLICT (provider, provider_user_id)
       DO UPDATE SET nickname = EXCLUDED.nickname
       RETURNING id, provider, provider_user_id AS "providerUserId", nickname, created_at AS "createdAt"`,
      [provider, providerUserId, nickname],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('app_user upsert가 행을 반환하지 않았어요');
    }
    return row;
  }

  async findUserById(id: string): Promise<AppUserRecord | null> {
    const result = await this.pool.query<AppUserRow>(
      `SELECT id, provider, provider_user_id AS "providerUserId", nickname, created_at AS "createdAt"
       FROM app_user WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async insertRefreshToken(record: InsertRefreshTokenParams, client: Queryable = this.pool): Promise<void> {
    await client.query(
      `INSERT INTO refresh_token (id, user_id, token_hash, family_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [record.id, record.userId, record.tokenHash, record.familyId, record.expiresAt],
    );
  }

  /** FOR UPDATE로 잠근 상태로 조회한다 — 동시에 같은 리프레시 토큰이 재사용되는 경쟁을 막는다 (AGENTS.md 규칙 10) */
  async findRefreshTokenByHashForUpdate(client: Queryable, tokenHash: string): Promise<RefreshTokenRecord | null> {
    const result = await client.query<RefreshTokenRow>(
      `SELECT id, user_id AS "userId", token_hash AS "tokenHash", family_id AS "familyId",
              expires_at AS "expiresAt", revoked_at AS "revokedAt"
       FROM refresh_token WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async revokeToken(client: Queryable, id: string): Promise<void> {
    await client.query(`UPDATE refresh_token SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [id]);
  }

  async revokeFamily(client: Queryable, familyId: string): Promise<void> {
    await client.query(`UPDATE refresh_token SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`, [
      familyId,
    ]);
  }
}
