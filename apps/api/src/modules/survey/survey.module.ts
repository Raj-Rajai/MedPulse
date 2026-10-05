import { Module } from '@nestjs/common';
import { ExportModule } from '../export/export.module';
import { FamilyModel } from './family.model';
import { SurveyController } from './survey.controller';

@Module({
    imports: [ExportModule],
    controllers: [SurveyController],
    providers: [FamilyModel],
    exports: [FamilyModel],
})
export class SurveyModule {}
