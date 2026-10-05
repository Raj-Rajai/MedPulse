import type { Row } from '../common/row';

/**
 * Identities attached to the request by the auth guards
 * (same property names the original Express middleware used).
 */
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            student: Row;
            studentId: number;
            rollNumber: string;
            admin: Row;
            adminId: number;
            patient: Row;
            patientId: number;
            hospitalAdmin: Row;
            hospitalId: number;
        }
    }
}

export {};
