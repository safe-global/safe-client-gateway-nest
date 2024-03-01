import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';

describe('Application bootstrap', () => {
  it('should init the app', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register()],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    expect(app).toBeDefined();
    await app.close();
  });
});
