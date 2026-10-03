import {Body,Controller,Get,Post,Put,Param,Req,UseGuards} from '@nestjs/common';import {ApiBearerAuth,ApiTags} from '@nestjs/swagger';import {JwtAuthGuard} from '../auth/guards/jwt-auth.guard';import {PatientService} from './patient.service';import {FamilyDto,HealthProfileDto,PrescriptionDto} from './patient.dto';
@ApiTags('patient')@ApiBearerAuth()@UseGuards(JwtAuthGuard)@Controller('patient')export class PatientController{constructor(private readonly s:PatientService){}
@Get('health')health(@Req()r:any){return this.s.health(r.user.id)} @Put('health')update(@Req()r:any,@Body()d:HealthProfileDto){return this.s.updateHealth(r.user.id,d)}
@Get('family')family(@Req()r:any){return this.s.family(r.user.id)} @Post('family')add(@Req()r:any,@Body()d:FamilyDto){return this.s.addFamily(r.user.id,d)}
@Get('prescriptions')prescriptions(@Req()r:any){return this.s.prescriptions(r.user.id)} @Post('prescriptions')prescribe(@Req()r:any,@Body()d:PrescriptionDto){return this.s.prescribe(r.user.id,d)}
}