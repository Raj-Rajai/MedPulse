import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { seedRoll235 } from '../database/seed-roll235';
import { seedAcademicSchedule } from './seed-academic-schedule';
import { CampaignModel } from '../modules/campaign/campaign.model';

/** Auto-seeds the Roll 235 survey on first boot, exactly when the original initDatabase() did. */
@Injectable()
export class SeedService implements OnModuleInit {
    constructor(
        private readonly database: DatabaseService,
        private readonly campaigns: CampaignModel,
    ) {}

    onModuleInit() {
        const db = this.database.db;
        try {
            // Auto-seed survey data (Roll 235) if families table is empty
            const familyCountRow = db.prepare('SELECT COUNT(*) as count FROM families').get();
            if (!familyCountRow || familyCountRow.count === 0) {
                console.log('🌱 No survey records found in database. Auto-seeding Roll 235 survey data...');
                try {
                    seedRoll235(db, this.campaigns);
                } catch (seedErr) {
                    console.error('⚠️ Could not auto-seed Roll 235 data:', (seedErr as Error).message);
                }
            }

            // Auto-seed academic teaching schedule if empty
            try {
                seedAcademicSchedule(db);
            } catch (schedErr) {
                console.error('⚠️ Could not auto-seed academic schedule:', (schedErr as Error).message);
            }

            console.log('✅ SQLite Database ready at:', this.database.path);
        } catch (err) {
            console.error('❌ Error initializing database:', err);
            throw err;
        }
    }
}
