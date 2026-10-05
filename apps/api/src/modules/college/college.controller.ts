import { Controller, Get } from '@nestjs/common';
import { serverError } from '../../common/http-error';
import { CollegeModel } from './college.model';

@Controller()
export class CollegeController {
    constructor(private readonly colleges: CollegeModel) {}

    @Get('colleges')
    getColleges() {
        try {
            return this.colleges.getAll();
        } catch (err) {
            throw serverError(err);
        }
    }
}
