import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

//* Register Schema
export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    email: z.email("Invalid email").trim(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    phone: z.string().trim().min(10, "Invalid phone number"),
  }),
  params: z.object({}),
  query: z.object({}),
});

//* Login Schema
export const loginSchema = z.object({
  body: z.object({
    email: z.email("Invalid email").trim(),
    password: z.string().min(1, "Password is required"),
  }),
  params: z.object({}),
  query: z.object({}),
});

//* User Profile Update Schema
export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).optional(),
      phone: z.string().trim().min(10).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required",
    }),
  params: z.object({}),
  query: z.object({}),
});

//* Add Address Schema
export const addressSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2, "Invalid full name"),
    phone: z.string().trim().min(10, "Invalid phone number"),
    addressLine1: z.string().trim().min(1, "Address is required"),
    addressLine2: z.string().trim().optional(),
    city: z.string().trim().min(1, "City is required"),
    state: z.string().trim().min(1, "State is required"),
    postalCode: z.string().trim().min(3, "Invalid postal code"),
    country: z.string().trim().min(1, "Country is required"),
    isDefault: z.boolean().optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

//* Update Address Schema
export const updateAddressSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(2).optional(),
      phone: z.string().trim().min(10).optional(),
      addressLine1: z.string().trim().min(1).optional(),
      addressLine2: z.string().trim().optional(),
      city: z.string().trim().min(1).optional(),
      state: z.string().trim().min(1).optional(),
      postalCode: z.string().trim().min(3).optional(),
      country: z.string().trim().min(1).optional(),
      isDefault: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required",
    }),
  params: z.object({
    id: objectId,
  }),
  query: z.object({}),
});

//* Admin - Customer Status Schema
export const updateCustomerStatusSchema = z.object({
  body: z.object({
    status: z.enum(["active", "blocked"]),
  }),
  params: z.object({
    id: objectId,
  }),
  query: z.object({}),
});

//* Add Cart Schema
export const cartAddSchema = z.object({
  body: z.object({
    products: z
      .array(
        z.object({
          product: objectId,
          variantId: objectId,
          quantity: z
            .number()
            .int("Quantity must be an integer")
            .min(1, "Quantity must be at least 1"),
        }),
      )
      .min(1, "At least one product is required"),
  }),
  params: z.object({}),
  query: z.object({}),
});

//* Cart Item Schema
export const cartItemSchema = z.object({
  body: z.object({
    variantId: objectId,
    quantity: z
      .number()
      .int("Quantity must be an integer")
      .min(1, "Quantity must be at least 1"),
  }),
  params: z.object({
    productId: objectId,
  }),
  query: z.object({}),
});

//* Remove Cart Item Schema
export const removeCartItemSchema = z.object({
  body: z.object({
    variantId: objectId,
  }),
  params: z.object({
    productId: objectId,
  }),
  query: z.object({}),
});

//* Order Schema
export const orderSchema = z.object({
  body: z.object({
    addressId: objectId,
  }),
  params: z.object({}),
  query: z.object({}),
});

//* Order by Id Schema
export const orderIdSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: objectId,
  }),
  query: z.object({}),
});

//* Product Query Schema
export const productQuerySchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    name: z.string().trim().optional(),
    price: z.coerce.number().positive().optional(),
    id: objectId.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(5),
    sort: z
      .enum([
        "newest",
        "oldest",
        "priceAsc",
        "priceDesc",
        "nameAsc",
        "nameDesc",
      ])
      .optional(),
  }),
});

//* Product Search Schema
export const productSearchSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    name: z.string().trim().optional(),
    price: z.coerce.number().positive().optional(),
    id: objectId.optional(),
  }),
});
