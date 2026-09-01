import "dotenv/config";
import { sendEmail } from "../services/emailServices.js";

const test = async () => {
  try {
    const result = await sendEmail(
      "example@gmail.com",
      "LastDrip Test Email",
      "<h1>Hello!</h1><p>This email was sent from LastDrip.</p>",
    );

    console.log("Email sent:", result);
  } catch (error) {
    console.error("Email failed:", error);
  }
};

test();
