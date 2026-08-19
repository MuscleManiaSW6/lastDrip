import express from "express";
import "dotenv/config";
import connectDB from "./config/DB.js";
import authRouter from "./routes/userAuth.js";
import productRouter from "./routes/products.js";
import orderRouter from "./routes/orders.js";
import cors from "cors";

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

app.use(cors());

app.use("/auth", authRouter);
app.use("/products", productRouter);
app.use("/orders", orderRouter);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Ecommerce Home Page" });
});

app.use((req, res) => {
  res.status(404).json({ message: "Page not found" });
});

const startServer = async () => {
  try {
    await connectDB();

    app.listen(port, () => {
      console.log(`Server running at ${port}`);
    });
  } catch (err) {
    console.log(err);
  }
};

startServer();
