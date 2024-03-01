import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CacheHooksService } from '@/routes/cache-hooks/cache-hooks.service';
import { EventValidationPipe } from '@/routes/cache-hooks/pipes/event-validation.pipe';
import { BasicAuthGuard } from '@/routes/common/auth/basic-auth.guard';
import { Event } from '@/routes/cache-hooks/entities/event.entity';

@Controller({
  path: '',
  version: '1',
})
@ApiExcludeController()
export class CacheHooksController {
  constructor(private readonly service: CacheHooksService) {}

  @UseGuards(BasicAuthGuard)
  @Post('/hooks/events')
  @HttpCode(202)
  async postEvent(@Body(EventValidationPipe) event: Event): Promise<void> {
    await this.service.onEvent(event);
  }
}
