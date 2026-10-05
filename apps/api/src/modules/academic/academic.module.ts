import { Module } from '@nestjs/common';
import { AcademicAdminController } from './academic-admin.controller';
import { AcademicController } from './academic.controller';
import { AcademicModel } from './academic.model';

@Module({
    controllers: [AcademicController, AcademicAdminController],
    providers: [AcademicModel],
    exports: [AcademicModel],
})
export class AcademicModule {}
