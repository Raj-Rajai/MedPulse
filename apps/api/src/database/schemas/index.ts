import type { SchemaModule } from '../db.types';
import { baselineSchema } from './000-baseline.schema';
import { coreSchema } from './00-core.schema';
import { crmSchema } from './10-crm.schema';
import { hmsSchema } from './20-hms.schema';
import { hospitalContactSchema } from './21-hospital-contact.schema';
import { geofenceSchema } from './22-geofence.schema';
import { fixesSchema } from './30-fixes.schema';
import { academicSchema } from './40-academic.schema';
import { consentSchema } from './50-consent.schema';

/**
 * Applied in this exact order on every boot (same as the filename order the
 * original backend/config/db.js used). Add new modules at the end.
 */
export const SCHEMAS: SchemaModule[] = [baselineSchema, coreSchema, crmSchema, hmsSchema, hospitalContactSchema, geofenceSchema, fixesSchema, academicSchema, consentSchema];
