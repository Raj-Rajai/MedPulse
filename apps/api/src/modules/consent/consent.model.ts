import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { Row } from '../../common/row';
import { randomUUID } from 'node:crypto';

export interface ConsentRecord {
    id?: number;
    consent_id: string;
    user_id: string;
    actor_id: string;
    role: string;
    consent_type: string;
    consent_version: string;
    purpose_version: string;
    privacy_policy_version: string;
    purpose_scope: string;
    action: 'GRANTED' | 'WITHDRAWN' | 'SUPERSEDED' | 'EXPIRED';
    source: string;
    ip_address?: string | null;
    user_agent?: string | null;
    timestamp: string;
    created_at?: string;
}

@Injectable()
export class ConsentModel {
    constructor(private readonly dbService: DatabaseService) {}

    private get db() {
        return this.dbService.db;
    }

    async getStatus(userId: string, consentType: string, version: string): Promise<{ consented: boolean; consent: Row | null }> {
        const rec = await this.db.queryOne(
            `SELECT * FROM consent_records
             WHERE user_id = $1 AND consent_type = $2 AND consent_version = $3
             ORDER BY id DESC LIMIT 1`,
            userId,
            consentType,
            version,
        );
        if (rec && rec.action === 'GRANTED') {
            return { consented: true, consent: rec };
        }
        return { consented: false, consent: null };
    }

    async recordConsent(data: {
        userId: string;
        actorId: string;
        role: string;
        consentType: string;
        consentVersion: string;
        purposeVersion: string;
        privacyPolicyVersion: string;
        purposeScope: string;
        action: 'GRANTED' | 'WITHDRAWN' | 'SUPERSEDED' | 'EXPIRED';
        source: string;
        ipAddress?: string | null;
        userAgent?: string | null;
    }): Promise<Row> {
        const consentId = `cst_${randomUUID()}`;
        const timestamp = new Date().toISOString();

        await this.db.execute(
            `INSERT INTO consent_records (
                consent_id, user_id, actor_id, role, consent_type,
                consent_version, purpose_version, privacy_policy_version,
                purpose_scope, action, source, ip_address, user_agent, timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            consentId,
            data.userId,
            data.actorId,
            data.role,
            data.consentType,
            data.consentVersion,
            data.purposeVersion,
            data.privacyPolicyVersion,
            data.purposeScope,
            data.action,
            data.source,
            data.ipAddress || null,
            data.userAgent || null,
            timestamp,
        );

        const rec = await this.db.queryOne('SELECT * FROM consent_records WHERE consent_id = $1', consentId);
        return rec!;
    }

    async getHistory(userId: string, consentType?: string): Promise<Row[]> {
        if (consentType) {
            return this.db.queryAll(
                `SELECT * FROM consent_records
                 WHERE user_id = $1 AND consent_type = $2
                 ORDER BY id DESC`,
                userId,
                consentType,
            );
        }
        return this.db.queryAll(
            `SELECT * FROM consent_records
             WHERE user_id = $1
             ORDER BY id DESC`,
            userId,
        );
    }
}
