const { z } = require('zod');

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    phone: z.string().min(1, 'Contact number is required'),
    role: z.enum(['fleet_manager', 'dispatcher', 'safety_officer', 'financial_analyst', 'driver']).optional()
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
  })
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address')
  })
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters')
  })
});

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    email: z.string().email('Invalid email address').optional(),
    phone: z.string().optional(),
    dateOfBirth: z.string().optional().nullable(),
    joiningDate: z.string().optional().nullable(),
    salary: z.number().optional().nullable(),
    profilePhoto: z.string().optional().nullable(),
    employeeId: z.string().optional().nullable(),
    department: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    emergencyContact: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    theme: z.enum(['dark', 'light', 'system']).optional(),
    accentColor: z.string().optional(),
    density: z.enum(['comfortable', 'compact']).optional(),
    fontSize: z.enum(['small', 'medium', 'large']).optional(),
    animations: z.boolean().optional(),
    sidebarState: z.enum(['expanded', 'collapsed']).optional()
  }).passthrough()
});

const updatePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters')
  })
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  updatePasswordSchema
};
