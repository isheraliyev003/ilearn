import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WordsController } from './words.controller';
import { WordsService } from './words.service';

@Module({
  imports: [AuthModule],
  controllers: [WordsController],
  providers: [WordsService],
})
export class WordsModule {}
