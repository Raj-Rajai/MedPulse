import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { seedRoll235 } from '../database/seed-roll235';
import { seedAcademicSchedule } from './seed-academic-schedule';
import { CampaignModel } from '../modules/campaign/campaign.model';

/** Auto-seeds the Roll 235 survey on first boot when the PostgreSQL database is empty. */
@Injectable()
export class SeedService implements OnModuleInit {
    constructor(
        private readonly database: DatabaseService,
        private readonly campaigns: CampaignModel,
    ) {}

    async onModuleInit(): Promise<void> {
        const db = this.database.db;
        try {
            const familyCountRow = await db.queryOne('SELECT COUNT(*) as count FROM families');
            if (!familyCountRow || familyCountRow.count === 0) {
                console.log('🌱 No survey records found in database. Auto-seeding Roll 235 survey data...');
                try {
                    await seedRoll235(db, this.campaigns);
                } catch (seedErr) {
                    console.error('⚠️ Could not auto-seed Roll 235 data:', (seedErr as Error).message);
                }
            }

            try {
                await seedAcademicSchedule(db);
            } catch (schedErr) {
                console.error('⚠️ Could not auto-seed academic schedule:', (schedErr as Error).message);
            }

            console.log('✅ PostgreSQL Database ready (Prisma ORM)');
        } catch (err) {
            console.error('❌ Error initializing database:', err);
            throw err;
        }
    }
}
