import type { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import {
  AppProvider,
  DEFAULT_CONFIGURATION,
  configureShutdownHooks,
} from '@/app.provider';

/**
 * A test {@link AppProvider}
 *
 * This provider provides an application given a {@link TestingModule}
 *
 * If the module provided is not a {@link TestingModule}, an error is thrown
 */
export class TestAppProvider<T> extends AppProvider<T> {
  // Disables shutdown hooks for tests (they are not required)
  // Enabling this in the tests might result in a MaxListenersExceededWarning
  // as the number of listeners that this adds exceed the default
  protected readonly configuration: Array<(app: INestApplication) => void> =
    DEFAULT_CONFIGURATION.filter((config) => config !== configureShutdownHooks);

  constructor() {
    super();
    if (process.env.NODE_ENV !== 'test') {
      throw Error('TestAppProvider used outside of a testing environment');
    }
  }

  protected getApp(module: T): Promise<INestApplication> {
    if (!(module instanceof TestingModule))
      return Promise.reject('Provided module is not a TestingModule');
    return Promise.resolve(module.createNestApplication());
  }
}
