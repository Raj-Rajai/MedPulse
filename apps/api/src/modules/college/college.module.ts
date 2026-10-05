import { Module } from '@nestjs/common';
import { CollegeController } from './college.controller';
import { CollegeModel } from './college.model';

@Module({
    controllers: [CollegeController],
    providers: [CollegeModel],
    exports: [CollegeModel],
})
export class CollegeModule {}
