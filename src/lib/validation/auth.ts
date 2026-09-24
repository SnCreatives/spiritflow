import { z } from 'zod';

const indianMobileRegex = /^[6-9]\d{9}$/;

export const LoginSchema = z.object({
  mobileNumber: z.string().trim().regex(indianMobileRegex, 'Please enter a valid 10-digit mobile number'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginSchemaType = z.infer<typeof LoginSchema>;
