import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { GeofenceModule } from './modules/geofence/geofence.module';
import { AdminModule } from './modules/admin/admin.module';
import { CampaignModule } from './modules/campaign/campaign.module';
import { CollegeModule } from './modules/college/college.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { HospitalModule } from './modules/hospital/hospital.module';
import { PatientModule } from './modules/patient/patient.module';
import { StudentModule } from './modules/student/student.module';
import { SurveyModule } from './modules/survey/survey.module';
import { AcademicModule } from './modules/academic/academic.module';
import { ConsentModule } from './modules/consent/consent.module';

/**
 * Feature modules are listed in the same order the original backend mounted its
 * routes/*.routes.js files (alphabetical), so overlapping paths resolve identically.
 */
@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        SeedModule,
        AdminModule, // admin.routes.js
        CampaignModule, // campaign.routes.js
        CollegeModule, // college.routes.js
        EngagementModule, // engagement.routes.js
        GeofenceModule, // geofence.routes.js
        HospitalModule, // hospital-fap.routes.js, hospital.routes.js
        PatientModule, // patient-portal.routes.js, patient.routes.js
        StudentModule, // auth.routes.js, student.routes.js
        SurveyModule, // survey.routes.js
        AcademicModule, // new: /api/academic/*, /api/admin/academic/* (no counterpart in the original backend)
        ConsentModule, // /api/consent/*
    ],
})
export class AppModule {}
