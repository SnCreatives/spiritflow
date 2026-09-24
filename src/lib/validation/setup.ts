import { z } from 'zod';

const indianMobileRegex = /^[6-9]\d{9}$/;
const vatRegex = /^[0-9A-Z]{9,20}$/i;

export const SetupSchema = z.object({
  businessName: z.string().trim().min(2, 'Business name must be at least 2 characters').max(100),
  address: z.string().trim().min(5, 'Address must be at least 5 characters').max(250),
  ownerMobile: z.string().trim().regex(indianMobileRegex, 'Owner mobile number must be a valid 10-digit Indian mobile number'),
  vatNumber: z.string().trim().optional().refine(val => !val || vatRegex.test(val.toUpperCase()), {
    message: 'Invalid State VAT / TIN format (9 to 20 alphanumeric characters, e.g. 27001234567V)',
  }),
  licenceReference: z.string().trim().max(100).optional(),
  mobileNumber: z.string().trim().regex(indianMobileRegex, 'Login mobile number must be a valid 10-digit Indian mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  confirmPassword: z.string().min(8, 'Password confirmation is required'),
  language: z.enum(['mr', 'hi']),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Password and Confirm Password must match',
  path: ['confirmPassword'],
});

export type SetupSchemaType = z.infer<typeof SetupSchema>;
