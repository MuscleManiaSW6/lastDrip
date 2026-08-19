import { z } from "zod";

const statusSchema = z
  .object({
    status: z.enum([
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ]),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Please provide a field to update",
  });

const validateStatus = (req, res, next) => {
  const validate = statusSchema.safeParse(req.body);

  if (!validate.success) {
    return res.status(400).json({ message: validate.error.issues[0].message });
  }

  next();
};

export { validateStatus };
