import { Module } from '@nestjs/common';
import { CollegeModule } from '../college/college.module';
import { ExportModule } from '../export/export.module';
import { AdminController } from './admin.controller';
import { AdminModel } from './admin.model';

@Module({
    imports: [CollegeModule, ExportModule],
    controllers: [AdminController],
    providers: [AdminModel],
    exports: [AdminModel],
})
export class AdminModule {}
