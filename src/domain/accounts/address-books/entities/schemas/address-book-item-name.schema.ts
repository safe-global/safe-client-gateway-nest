import { z } from 'zod';

export const AddressBookItemNameSchema = z
  .string()
  .min(3, {
    message: 'Address book entry names must be at least 3 characters long',
  })
  .max(50, {
    message: 'Address book entry names must be at most 50 characters long',
  })
  .regex(/^[a-zA-Z0-9]+(?:[._-][a-zA-Z0-9]+)*$/, {
    message:
      'Address book entry names must start with a letter or number and can contain alphanumeric characters, periods, underscores, or hyphens',
  });
