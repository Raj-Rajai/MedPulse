import { Module } from '@nestjs/common';
import { ConsentController } from './consent.controller';
import { ConsentModel } from './consent.model';

@Module({
    controllers: [ConsentController],
    providers: [ConsentModel],
    exports: [ConsentModel],
})
export class ConsentModule {}
