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

    getStatus(userId: string, consentType: string, version: string): { consented: boolean; consent: Row | null } {
        const stmt = this.db.prepare(`
            SELECT * FROM consent_records
            WHERE user_id = ? AND consent_type = ? AND consent_version = ?
            ORDER BY id DESC LIMIT 1
        `);
        const rec = stmt.get(userId, consentType, version);
        if (rec && rec.action === 'GRANTED') {
            return { consented: true, consent: rec };
        }
        return { consented: false, consent: null };
    }

    recordConsent(data: {
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
    }): Row {
        const consentId = `cst_${randomUUID()}`;
        const timestamp = new Date().toISOString();

        const insert = this.db.prepare(`
            INSERT INTO consent_records (
                consent_id, user_id, actor_id, role, consent_type,
                consent_version, purpose_version, privacy_policy_version,
                purpose_scope, action, source, ip_address, user_agent, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insert.run(
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
            timestamp
        );

        const rec = this.db.prepare('SELECT * FROM consent_records WHERE consent_id = ?').get(consentId);
        return rec!;
    }

    getHistory(userId: string, consentType?: string): Row[] {
        if (consentType) {
            return this.db.prepare(`
                SELECT * FROM consent_records
                WHERE user_id = ? AND consent_type = ?
                ORDER BY id DESC
            `).all(userId, consentType);
        }
        return this.db.prepare(`
            SELECT * FROM consent_records
            WHERE user_id = ?
            ORDER BY id DESC
        `).all(userId);
    }
}
