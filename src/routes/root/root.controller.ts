import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';

@Controller()
@ApiExcludeController()
export class RootController {
  @Get()
  getIndex(@Res() res: Response): void {
    return res.redirect('/index.html');
  }
}
