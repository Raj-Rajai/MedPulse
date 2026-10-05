import { Module } from '@nestjs/common';
import { HospitalController } from './hospital.controller';
import { HospitalFapController } from './hospital-fap.controller';
import { HospitalFapModel } from './hospital-fap.model';
import { HospitalVisitModel } from './hospital-visit.model';
import { HospitalModel } from './hospital.model';

@Module({
    controllers: [HospitalController, HospitalFapController],
    providers: [HospitalModel, HospitalVisitModel, HospitalFapModel],
    exports: [HospitalModel, HospitalVisitModel, HospitalFapModel],
})
export class HospitalModule {}
