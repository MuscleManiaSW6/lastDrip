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

export { sendEmail };
