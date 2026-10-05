import { Module } from '@nestjs/common';
import { EngagementController } from './engagement.controller';
import { EngagementModel } from './engagement.model';

@Module({
    controllers: [EngagementController],
    providers: [EngagementModel],
    exports: [EngagementModel],
})
export class EngagementModule {}
