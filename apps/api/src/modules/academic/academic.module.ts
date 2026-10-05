import { Module } from '@nestjs/common';
import { AcademicAdminController } from './academic-admin.controller';
import { AcademicController } from './academic.controller';
import { AcademicModel } from './academic.model';
import { AttendanceClusterService } from './attendance-cluster.service';

@Module({
    controllers: [AcademicController, AcademicAdminController],
    providers: [AcademicModel, AttendanceClusterService],
    exports: [AcademicModel],
})
export class AcademicModule {}
