import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/DB.js";

const port = process.env.PORT || 3000;

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
