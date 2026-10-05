import { Module } from '@nestjs/common';
import { CampaignController } from './campaign.controller';
import { CampaignModel } from './campaign.model';

@Module({
    controllers: [CampaignController],
    providers: [CampaignModel],
    exports: [CampaignModel],
})
export class CampaignModule {}
