import { Module } from '@nestjs/common';
import { HospitalCallbackModel } from './hospital-callback.model';
import { PatientFamilyModel } from './patient-family.model';
import { PatientPortalController } from './patient-portal.controller';
import { PatientController } from './patient.controller';
import { PatientModel } from './patient.model';
import { PatientPrivacyService } from './patient-privacy.service';
import { PatientPrivacyController } from './patient-privacy.controller';

// Controller order mirrors the original mount order: patient-portal.routes.js, then patient.routes.js.
@Module({
    controllers: [PatientPortalController, PatientController, PatientPrivacyController],
    providers: [PatientModel, PatientFamilyModel, HospitalCallbackModel, PatientPrivacyService],
    exports: [PatientModel, PatientFamilyModel, HospitalCallbackModel],
})
export class PatientModule {}
