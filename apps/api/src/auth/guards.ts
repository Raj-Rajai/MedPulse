import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

const request = (ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request>();

@Injectable()
export class StudentGuard implements CanActivate {
    constructor(private readonly auth: AuthService) {}
    canActivate(ctx: ExecutionContext): boolean {
        this.auth.authenticateStudent(request(ctx));
        return true;
    }
}

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly auth: AuthService) {}
    canActivate(ctx: ExecutionContext): boolean {
        this.auth.authenticateAdmin(request(ctx));
        return true;
    }
}

@Injectable()
export class PatientGuard implements CanActivate {
    constructor(private readonly auth: AuthService) {}
    canActivate(ctx: ExecutionContext): boolean {
        this.auth.authenticatePatient(request(ctx));
        return true;
    }
}

@Injectable()
export class HospitalGuard implements CanActivate {
    constructor(private readonly auth: AuthService) {}
    canActivate(ctx: ExecutionContext): boolean {
        this.auth.authenticateHospitalAdmin(request(ctx));
        return true;
    }
}
