import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminGuard, HospitalGuard, PatientGuard, StudentGuard } from './guards';
import { PortalSessionService } from './portal-session.service';
import { PortalSessionController } from './portal-session.controller';

@Global()
@Module({
    controllers: [PortalSessionController],
    providers: [PortalSessionService, AuthService, StudentGuard, AdminGuard, PatientGuard, HospitalGuard],
    exports: [PortalSessionService, AuthService, StudentGuard, AdminGuard, PatientGuard, HospitalGuard],
})
export class AuthModule {}
