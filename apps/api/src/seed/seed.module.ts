import { Module } from '@nestjs/common';
import { CampaignModule } from '../modules/campaign/campaign.module';
import { SeedService } from './seed.service';

@Module({
    imports: [CampaignModule],
    providers: [SeedService],
})
export class SeedModule {}
