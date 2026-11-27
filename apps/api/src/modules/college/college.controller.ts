import { Controller, Get } from '@nestjs/common';
import { serverError } from '../../common/http-error';
import { CollegeModel } from './college.model';

@Controller()
export class CollegeController {
    constructor(private readonly colleges: CollegeModel) {}

    @Get('colleges')
    async getColleges() {
        try {
            return await this.colleges.getAll();
        } catch (err) {
            throw serverError(err);
        }
    }
}
