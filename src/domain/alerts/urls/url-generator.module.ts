import { Module } from '@nestjs/common';
import { UrlGeneratorHelper } from '@/domain/alerts/urls/url-generator.helper';

@Module({
  providers: [UrlGeneratorHelper],
  exports: [UrlGeneratorHelper],
})
export class UrlGeneratorModule {}
