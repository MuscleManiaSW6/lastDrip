import express from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./config/env.js";

import authRouter from "./routes/userAuth.js";
import productRouter from "./routes/products.js";
import cartRouter from "./routes/cart.js";
import orderRouter from "./routes/orders.js";
import webhookRouter from "./routes/webhooks.js";

import errorHandler from "./middlewares/errorhandler.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: env.CLIENT_URL || "http://localhost:5173",
  }),
);

app.use("/webhooks", express.raw({ type: "application/json" }), webhookRouter);

app.use(express.json({ limit: "100kb" }));

app.use("/users", authRouter);
app.use("/products", productRouter);
app.use("/cart", cartRouter);
app.use("/orders", orderRouter);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Ecommerce Home Page" });
});

app.use((req, res) => {
  res.status(404).json({ message: "Page not found" });
});

app.use(errorHandler);

export default app;
