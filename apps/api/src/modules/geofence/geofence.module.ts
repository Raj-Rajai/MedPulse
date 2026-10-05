import { Global, Module } from '@nestjs/common';
import { GeofenceController } from './geofence.controller';
import { GeofenceService } from './geofence.service';

@Global()
@Module({
    controllers: [GeofenceController],
    providers: [GeofenceService],
    exports: [GeofenceService],
})
export class GeofenceModule {}
