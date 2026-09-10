import resend from "../config/resend.js";
import { retry } from "../utils/retry.js";
import EmailJob from "../models/EmailJob.js";

const sendEmail = async (to, subject, html) => {
  return await retry(async () => {
    const { data, error } = await resend.emails.send({
      from: "LastDrip <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    if (error) {
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }

    return data;
  });
};

const queueEmail = async (to, subject, html) => {
  return await EmailJob.create({
    to,
    subject,
    html,
  });
};

const orderConfirmationEmail = async (order) => {
  const html = `
  <h1>Order Confirmed</h1>

  <p>Hi ${order.user.name},</p>

  <p>Thank you for your order</p>

  <h2>Order Details</h2>

  <p><strong>Order ID: </strong> ${order.orderNumber}</p>

  <ul>
    ${order.products
      .map(
        (item) => `<li>
      ${item.name} x ${item.quantity} - Rs${item.price * item.quantity}
      </li>`,
      )
      .join("")}
  </ul>

  <p>Your payment has been successfully received and your order is now confirmed.</p>
  `;

  return {
    to: order.user.email,
    subject: "lastDrip - Order Confirmation",
    html,
  };
};

const paymentFailureEmail = async (order) => {
  const html = `
  <h1>Payment Failed<h1/>

  <p>Hi ${order.user.name}, </p>

  <p>Unfortunately, your payment for the following order was unsuccessful</p>

  <h2>Order Details</h2>

  <p><strong>Order ID:</strong>${order._id}</p>

  <ul>
  ${order.products
    .map(
      (item) =>
        `<li>${item.name} x ${item.quantity} - Rs${item.price * item.quantity}</li>`,
    )
    .join("")}
  </ul>
  `;

  return {
    to: order.user.email,
    subject: "lastDrip - Payment Failed",
    html,
  };
};

export { sendEmail, orderConfirmationEmail, paymentFailureEmail, queueEmail };
