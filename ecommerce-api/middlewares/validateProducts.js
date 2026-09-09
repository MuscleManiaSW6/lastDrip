import { z } from "zod";

const variantSchema = z.object({
  sku: z.string().trim().min(1, "Invalid SKU"),
  size: z.string().trim().min(1, "Invalid size"),
  color: z.string().trim().min(1, "Invalid color"),
  stock: z.number().min(0, "Invalid stock"),
  price: z.number().positive("Invalid variant price").optional(),
});

const imageSchema = z.object({
  url: z.string().trim().url("Invalid image URL"),
  alt: z.string().trim().optional(),
});

//* PUT Schema
const putSchema = z.object({
  name: z.string().trim().min(1, "Invalid name"),
  price: z.number().positive("Invalid price"),
  description: z.string().trim().min(1, "Invalid description"),
  category: z.string().trim().min(1, "Invalid category"),
  variants: z.array(variantSchema).min(1, "At least one variant is required"),
  images: z.array(imageSchema).optional(),
});

//* PATCH Schema
const patchSchema = z
  .object({
    name: z.string().trim().min(1, "Invalid name").optional(),

    price: z.number().positive("Invalid price").optional(),

    description: z.string().trim().min(1, "Invalid description").optional(),

    category: z.string().trim().min(1, "Invalid category").optional(),

    variants: z.array(variantSchema).min(1).optional(),

    images: z.array(imageSchema).optional(),

    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Please provide a field to update",
  });

//* PUT Validation
const validatePut = (req, res, next) => {
  const validate = putSchema.safeParse(req.body);

  if (!validate.success) {
    return res.status(400).json({
      message: validate.error.issues[0].message,
    });
  }

  next();
};

//* PATCH Validation
const validatePatch = (req, res, next) => {
  const validate = patchSchema.safeParse(req.body);

  if (!validate.success) {
    return res.status(400).json({
      message: validate.error.issues[0].message,
    });
  }

  next();
};

export { validatePut, validatePatch };
