import { appendNotificationLog } from "./storage.js";

const resendEndpoint = "https://api.resend.com/emails";

export async function notifyBookingSubmitted(booking) {
  const dateLabel = getDateLabel(booking);
  const message = [
    `Hello ${booking.requesterName},`,
    "",
    `Your bus request for ${dateLabel} has been submitted successfully and is now waiting for approval.`,
    `Booking type: ${booking.bookingType === "full_day" ? "Full day" : `Half day (${booking.timeSlot})`}`,
    `Event: ${booking.eventName}`,
    booking.trackingCode ? `Tracking code: ${booking.trackingCode}` : null,
    booking.trackingCode ? `Track request: /track?code=${booking.trackingCode}` : null,
    "",
    "We will send you another update after the request is reviewed.",
  ]
    .filter(Boolean)
    .join("\n");

  return sendNotifications({
    booking,
    eventType: "submitted",
    message,
    subject: "Church bus request received",
  });
}

export async function notifyBookingDecision(booking) {
  const dateLabel = getDateLabel(booking);
  const decisionText = getDecisionText(booking.status);
  const message = [
    `Hello ${booking.requesterName},`,
    "",
    `Your church bus request for ${dateLabel} has been ${decisionText}.`,
    `Event: ${booking.eventName}`,
    booking.adminNotes ? `Admin note: ${booking.adminNotes}` : null,
    "",
    getDecisionInstruction(booking.status),
  ]
    .filter(Boolean)
    .join("\n");

  return sendNotifications({
    booking,
    eventType: "decision",
    message,
    subject: `Church bus request ${getDecisionText(booking.status)}`,
  });
}

function getDecisionText(status) {
  if (status === "awaiting_payment") {
    return "approved to proceed to payment";
  }

  if (status === "approved") {
    return "released";
  }

  return "declined";
}

function getDecisionInstruction(status) {
  if (status === "awaiting_payment") {
    return "Please contact the accounts desk to complete payment.";
  }

  if (status === "approved") {
    return "The bus has been released. Please keep time and passenger details unchanged unless the transport team agrees to an update.";
  }

  return "If you still need the bus, please contact the transport team or submit a new request for another slot.";
}

async function sendNotifications({ booking, eventType, message, subject }) {
  const results = [];

  results.push(await sendEmail({ booking, message, subject }));
  results.push(await sendSms({ booking, message }));

  const summary = {
    attemptedAt: new Date().toISOString(),
    bookingId: booking.id,
    eventType,
    results,
  };

  await appendNotificationLog(summary);
  return summary;
}

async function sendEmail({ booking, message, subject }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;

  if (!apiKey || !from || !booking.requesterEmail) {
    return {
      channel: "email",
      status: "skipped",
      reason: "Email provider is not configured.",
    };
  }

  try {
    const response = await fetch(resendEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        subject,
        text: message,
        to: [booking.requesterEmail],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        channel: "email",
        status: "failed",
        reason: detail || "Email provider rejected the request.",
      };
    }

    return {
      channel: "email",
      status: "sent",
    };
  } catch (error) {
    return {
      channel: "email",
      status: "failed",
      reason: error.message,
    };
  }
}

async function sendSms({ booking, message }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from || !booking.phone) {
    return {
      channel: "sms",
      status: "skipped",
      reason: "SMS provider is not configured.",
    };
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          Body: message,
          From: from,
          To: booking.phone,
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return {
        channel: "sms",
        status: "failed",
        reason: detail || "SMS provider rejected the request.",
      };
    }

    return {
      channel: "sms",
      status: "sent",
    };
  } catch (error) {
    return {
      channel: "sms",
      status: "failed",
      reason: error.message,
    };
  }
}

function getDateLabel(booking) {
  const fromDate = booking.fromDate || booking.travelDate;
  const toDate = booking.toDate || booking.travelDate;

  if (!fromDate || !toDate) {
    return "the selected date";
  }

  return fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;
}
