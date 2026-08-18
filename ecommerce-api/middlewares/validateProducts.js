import { z } from "zod";

//* PUT Schema
const putSchema = z.object({
  name: z.string().trim().min(1, "Invalid name"),
  price: z
    .number({ invalid_type_error: "Invalid price type" })
    .positive("Invalid price"),
  description: z.string().trim().min(1, "Invalid description"),
  category: z.string().trim().min(1, "Invalid category"),
  stock: z
    .number({ invalid_type_error: "Invalid stock type" })
    .min(0, "Invalid stock"),
});

//* PATCH Schema
const patchSchema = z
  .object({
    name: z.string().trim().min(1, "Invalid name").optional(),
    price: z
      .number({ invalid_type_error: "Invalid price type" })
      .positive("Invalid price")
      .optional(),
    description: z.string().trim().min(1, "Invalid description").optional(),
    category: z.string().trim().min(1, "Invalid category").optional(),
    stock: z
      .number({ invalid_type_error: "Invalid stock type" })
      .min(0, "Invalid stock")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Please provide a field to update",
  });

//* PUT Validation
const validatePut = (req, res, next) => {
  const validate = putSchema.safeParse(req.body);

  if (!validate.success) {
    return res.status(400).json({ message: validate.error.issues[0].message });
  }

  next();
};

//* PATCH Validation
const validatePatch = (req, res, next) => {
  const validate = patchSchema.safeParse(req.body);

  if (!validate.success) {
    return res.status(400).json({ message: validate.error.issues[0].message });
  }

  next();
};

export { validatePut, validatePatch };
