import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { StudentController } from './student.controller';
import { StudentModel } from './student.model';

@Module({
    controllers: [StudentController, AuthController],
    providers: [StudentModel],
    exports: [StudentModel],
})
export class StudentModule {}
