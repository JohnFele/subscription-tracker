import nodemailer from 'nodemailer';
import { GMAIL_USER, GMAIL_PASS } from './env.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
});

export default transporter;
