import { appendNotificationLog, readNotificationSettings, saveSmsCreditStatus } from "./storage.js";

const resendEndpoint = "https://api.resend.com/emails";
const cSmsEndpoint = "https://app.mycsms.com/api/v3/sms/send";

export async function notifyBookingSubmitted(booking) {
  const settings = await readNotificationSettings();
  const dateLabel = getDateLabel(booking);
  const trackingUrl = booking.trackingCode ? buildPublicUrl(`/track?code=${encodeURIComponent(booking.trackingCode)}`) : "";
  const adminUrl = buildPublicUrl(`/admin?booking=${encodeURIComponent(booking.id)}`);
  const requesterMessage = [
    `Bus request received for ${dateLabel}.`,
    `Event: ${booking.eventName}`,
    trackingUrl ? `Track: ${trackingUrl}` : null,
  ].filter(Boolean).join("\n");

  const adminMessage = [
    "New bus request.",
    `${booking.requesterName} - ${booking.eventName}`,
    dateLabel,
    `Open: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendNotifications({
    booking,
    eventType: "submitted",
    notifications: [
      {
        email: booking.requesterEmail,
        phone: booking.phone,
        recipientRole: "requester",
        message: requesterMessage,
        subject: "Church bus request received",
      },
      ...settings.adminPhones.map((phone) => ({
        phone,
        recipientRole: "admin_contact",
        message: adminMessage,
      })),
    ],
  });
}

export async function notifyBookingDecision(booking) {
  const settings = await readNotificationSettings();
  const dateLabel = getDateLabel(booking);
  const decisionText = getDecisionText(booking.status);
  const trackingUrl = booking.trackingCode ? buildPublicUrl(`/track?code=${encodeURIComponent(booking.trackingCode)}`) : "";
  const financeUrl = buildPublicUrl(`/finance?booking=${encodeURIComponent(booking.id)}`);
  const requesterMessage = [
    `Bus request ${decisionText} for ${dateLabel}.`,
    `Event: ${booking.eventName}`,
    trackingUrl ? `Track: ${trackingUrl}` : null,
  ].filter(Boolean).join("\n");

  const notifications = [
    {
      email: booking.requesterEmail,
      phone: booking.phone,
      recipientRole: "requester",
      message: requesterMessage,
      subject: `Church bus request ${getDecisionText(booking.status)}`,
    },
  ];

  if (booking.status === "awaiting_payment") {
    const financeMessage = [
      "Bus request awaiting payment.",
      `${booking.requesterName} - ${booking.eventName}`,
      dateLabel,
      `Open: ${financeUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    notifications.push(
      ...settings.financePhones.map((phone) => ({
        phone,
        recipientRole: "finance_contact",
        message: financeMessage,
      })),
    );
  }

  if (booking.status === "approved" && booking.driverPhone) {
    const driverMessage = [
      `Bus assigned for ${dateLabel}.`,
      `Event: ${booking.eventName}`,
      `Requester: ${booking.requesterName}`,
      booking.pickupLocation ? `Pickup: ${booking.pickupLocation}` : null,
      booking.assignedVehicleLabel ? `Bus: ${booking.assignedVehicleLabel}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    notifications.push({
      phone: booking.driverPhone,
      recipientRole: "driver",
      message: driverMessage,
    });
  }

  return sendNotifications({
    booking,
    eventType: "decision",
    notifications,
  });
}

export async function notifyPaymentConfirmed(booking) {
  const settings = await readNotificationSettings();
  const dateLabel = getDateLabel(booking);
  const trackingUrl = booking.trackingCode ? buildPublicUrl(`/track?code=${encodeURIComponent(booking.trackingCode)}`) : "";
  const adminUrl = buildPublicUrl(`/admin?booking=${encodeURIComponent(booking.id)}`);
  const requesterMessage = [
    `Payment confirmed for ${dateLabel}.`,
    `Event: ${booking.eventName}`,
    trackingUrl ? `Track: ${trackingUrl}` : null,
  ].filter(Boolean).join("\n");

  const adminMessage = [
    "Payment confirmed.",
    `${booking.requesterName} - ${booking.eventName}`,
    dateLabel,
    `Open: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendNotifications({
    booking,
    eventType: "payment_confirmed",
    notifications: [
      {
        email: booking.requesterEmail,
        phone: booking.phone,
        recipientRole: "requester",
        message: requesterMessage,
        subject: "Church bus payment confirmed",
      },
      ...settings.adminPhones.map((phone) => ({
        phone,
        recipientRole: "admin_contact",
        message: adminMessage,
      })),
    ],
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

function buildPublicUrl(path) {
  const baseUrl = String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  const safePath = path.startsWith("/") ? path : `/${path}`;

  return baseUrl ? `${baseUrl}${safePath}` : safePath;
}

async function sendNotifications({ booking, eventType, notifications }) {
  const results = [];

  for (const notification of notifications) {
    if (notification.email) {
      results.push(
        await sendEmail({
          message: notification.message,
          recipientRole: notification.recipientRole,
          subject: notification.subject,
          to: notification.email,
        }),
      );
    }

    if (notification.phone) {
      results.push(
        await sendSms({
          message: notification.message,
          phone: notification.phone,
          recipientRole: notification.recipientRole,
        }),
      );
    }
  }

  const summary = {
    attemptedAt: new Date().toISOString(),
    bookingId: booking.id,
    eventType,
    results,
  };

  await appendNotificationLog(summary);
  return summary;
}

async function sendEmail({ message, recipientRole, subject, to }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;

  if (!apiKey || !from || !to) {
    return {
      channel: "email",
      recipientRole: recipientRole || "unknown",
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
        to: [to],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        channel: "email",
        recipientRole: recipientRole || "unknown",
        status: "failed",
        reason: detail || "Email provider rejected the request.",
      };
    }

    return {
      channel: "email",
      recipientRole: recipientRole || "unknown",
      status: "sent",
    };
  } catch (error) {
    return {
      channel: "email",
      recipientRole: recipientRole || "unknown",
      status: "failed",
      reason: error.message,
    };
  }
}

async function sendSms({ message, phone, recipientRole }) {
  const cSmsApiKey = process.env.CSMS_API_KEY;
  const cSmsSenderId = process.env.CSMS_SENDER_ID;

  if (cSmsApiKey && cSmsSenderId && phone) {
    return sendCsmsSms({
      apiKey: cSmsApiKey,
      message,
      phone,
      recipientRole,
      senderId: cSmsSenderId,
    });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from || !phone) {
    return {
      channel: "sms",
      recipientRole: recipientRole || "unknown",
      status: "skipped",
      reason: "SMS provider is not configured.",
    };
  }

  try {
    const twilioPhone = formatGhanaPhoneForTwilio(phone);

    if (!twilioPhone) {
      return {
        channel: "sms",
        recipientRole: recipientRole || "unknown",
        status: "failed",
        reason: "The phone number is not a supported Ghana mobile number.",
      };
    }

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
          To: twilioPhone,
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return {
        channel: "sms",
        provider: "twilio",
        recipientRole: recipientRole || "unknown",
        status: "failed",
        reason: detail || "SMS provider rejected the request.",
      };
    }

    return {
      channel: "sms",
      provider: "twilio",
      recipientRole: recipientRole || "unknown",
      status: "sent",
    };
  } catch (error) {
    return {
      channel: "sms",
      recipientRole: recipientRole || "unknown",
      status: "failed",
      reason: error.message,
    };
  }
}

async function sendCsmsSms({ apiKey, message, phone, recipientRole, senderId }) {
  const formattedPhone = formatGhanaPhoneForSms(phone);

  if (!formattedPhone) {
    return {
      channel: "sms",
      recipientRole: recipientRole || "unknown",
      status: "failed",
      reason: "The phone number is not a supported Ghana mobile number.",
    };
  }

  try {
    const response = await fetch(cSmsEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        message_type: "text",
        phone: [formattedPhone],
        sender_id: senderId,
      }),
    });

    const payload = await readJsonSafely(response);

    if (!response.ok) {
      return {
        channel: "sms",
        provider: "csms",
        recipientRole: recipientRole || "unknown",
        status: "failed",
        reason: payload?.message || "cSMS rejected the request.",
      };
    }

    const result = payload?.data?.results?.[0];
    const costInfo = payload?.data?.cost_info;

    if (costInfo) {
      await saveSmsCreditStatus({
        balanceAfter: costInfo.balance_after,
        balanceBefore: costInfo.balance_before,
        lastUpdatedAt: new Date().toISOString(),
        lowCredit: Number(costInfo.balance_after) < 100,
        lowCreditThreshold: 100,
        perMessage: costInfo.per_message,
        provider: "csms",
        recipientCount: costInfo.recipient_count,
        segmentsPerMessage: costInfo.segments_per_message,
        totalCost: costInfo.total_cost,
      });
    }

    return {
      channel: "sms",
      costInfo: costInfo || null,
      messageId: result?.message_id || null,
      provider: "csms",
      recipientRole: recipientRole || "unknown",
      status: result?.status === "processed" ? "sent" : "queued",
    };
  } catch (error) {
    return {
      channel: "sms",
      recipientRole: recipientRole || "unknown",
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

export function formatGhanaPhoneForSms(value) {
  const localNumber = formatGhanaPhoneForStorage(value);
  if (localNumber) {
    return `233${localNumber.slice(1)}`;
  }

  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("233")) {
    return digits;
  }

  return "";
}

export function formatGhanaPhoneForStorage(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10 && digits.startsWith("0")) {
    return digits;
  }

  if (digits.length === 12 && digits.startsWith("233")) {
    return `0${digits.slice(3)}`;
  }

  return "";
}

function formatGhanaPhoneForTwilio(value) {
  const smsNumber = formatGhanaPhoneForSms(value);
  return smsNumber ? `+${smsNumber}` : "";
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
