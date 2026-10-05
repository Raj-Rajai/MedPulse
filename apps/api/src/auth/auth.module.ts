import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminGuard, HospitalGuard, PatientGuard, StudentGuard } from './guards';

@Global()
@Module({
    providers: [AuthService, StudentGuard, AdminGuard, PatientGuard, HospitalGuard],
    exports: [AuthService, StudentGuard, AdminGuard, PatientGuard, HospitalGuard],
})
export class AuthModule {}
