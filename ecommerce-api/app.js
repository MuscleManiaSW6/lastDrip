import express from "express";
import cors from "cors";

import authRouter from "./routes/userAuth.js";
import productRouter from "./routes/products.js";
import orderRouter from "./routes/orders.js";
import webhookRouter from "./routes/webhooks.js";

import errorHandler from "./middlewares/errorhandler.js";

const app = express();

app.use(cors());

app.use("/webhooks", express.raw({ type: "application/json" }), webhookRouter);

app.use(express.json());

app.use("/auth", authRouter);
app.use("/products", productRouter);
app.use("/orders", orderRouter);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Ecommerce Home Page" });
});

app.use((req, res) => {
  res.status(404).json({ message: "Page not found" });
});

app.use(errorHandler);

export default app;
