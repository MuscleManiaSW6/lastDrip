import resend from "../config/resend.js";

const sendEmail = async (to, subject, html) => {
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
};

const orderConfirmationEmail = async (order) => {
  const html = `
  <h1>Order Confirmed</h1>

  <p>Hi ${order.user.name},</p>

  <p>Thank you for your order</p>

  <h2>Order Details</h2>

  <p><strong>Order ID: </strong> ${order._id}</p>

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

  return await sendEmail(
    order.user.email,
    "lastDrip - Order Confirmation",
    html,
  );
};

const paymentFailureEmail = async (order) => {
  const html = `
  <h1>Payment Failed<h1/>

  <p>Hi ${order.user.name}, </p>

  <p>Unfortunately, your payment for the following order was unsuccessful</p>

  <h2>Order Details</h2>

  <p><strong>Order ID:</strong>${order._id}</p>

  <ul>
  ${order.products.map((item) => `<li>${item.name} x ${item.quantity} - Rs${item.price * item.quantity}</li>`).join("")}
  </ul>
  `;

  return await sendEmail(order.user.email, "lastDrip - Payment Failed", html);
};

export { sendEmail, orderConfirmationEmail, paymentFailureEmail };
