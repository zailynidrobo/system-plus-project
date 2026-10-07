import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module.js';
import { AcademicModule } from './academic/academic.module.js';

@Module({
  imports: [UsersModule, AcademicModule],
})
export class AppModule {}