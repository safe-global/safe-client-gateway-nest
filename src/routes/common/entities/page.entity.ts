import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Page as DomainPage } from '@/domain/entities/page.entity';

/**
 * The SwaggerModule cannot generate model definitions based on Generics
 *
 * Therefore, a specific implementation of this class is required in order
 * to generate the correct OpenApi stubs.
 *
 * eg.: In order to represent on a route that it returns a {@link Page} of
 * {@link Chain} you can create a ChainPage which extends this one while
 * specifying T as Chain.
 *
 * The route would then specify @ApiOkResponse({ type: ChainPage }) as the
 * return type
 */
export abstract class Page<T> implements DomainPage<T> {
  @ApiProperty()
  count!: number;
  // ApiPropertyOptional without any options
  // does not work with unions with null
  // see https://github.com/nestjs/swagger/issues/2129
  @ApiPropertyOptional({ type: String, nullable: true })
  next!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  previous!: string | null;
  abstract results: T[];
}
