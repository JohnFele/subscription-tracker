import dayjs from "dayjs";
import { emailTemplates } from "./email.template.js";
import { GMAIL_USER } from "../config/env.js";
import transporter from "../config/nodemailer.js";

export const sendEmailReminder = async ({ to, type, subscription }) => {
  if(!to || !type || !subscription) {
    throw new Error("Missing required parameters: to, type, subscription");
  }

  const emailTemplate = emailTemplates.find(template => template.label === type);

  if (!emailTemplate) {
    throw new Error(`Email template for type "${type}" not found`);
  }

  const mailInfo = {
    userName: subscription.user.name,
    subscriptionName: subscription.name,
    renewalDate: dayjs(subscription.renewalDate).format('DD-MM-YYYY'),
    planName: subscription.name,
    price: `${subscription.currency} ${subscription.price} ${subscription.frequency}`,
    paymentMethod: subscription.paymentMethod,
  }

  const message = emailTemplate.generateBody(mailInfo);
  const subject = emailTemplate.generateSubject(mailInfo);

  const mailOptions = {
    from: GMAIL_USER,
    to,
    subject,
    html: message,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
      throw new Error("Failed to send email reminder");
    } else {
      console.log("Email sent successfully:", info.response);
    }
  });
  return true;
};