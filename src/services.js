import {
  buildBookingRecord,
  getBookingTypeLabel,
  getTimeSlotLabel,
  sanitizeDecisionInput,
  validateBookingRequest,
} from "./bookings.js";
import {
  notifyBookingDecision,
  notifyPaymentConfirmed,
  notifyBookingSubmitted,
  formatGhanaPhoneForStorage,
} from "./notifications.js";
import { findVehicleById, getAvailableVehicles, getFleet, getVehicleDisplay } from "./fleet.js";
import { HttpError } from "./http.js";
import {
  readAccessSettings,
  readBookings,
  readNotificationSettings,
  saveAccessSettings,
  saveBooking,
  saveNotificationSettings,
} from "./storage.js";

export async function submitBookingRequest(input) {
  const validation = validateBookingRequest(input);

  if (!validation.ok) {
    throw new HttpError(400, "Please correct the highlighted booking details.", {
      fields: validation.errors,
    });
  }

  const booking = buildBookingRecord(validation.value);
  await saveBooking(booking);

  const notificationSummary = await notifyBookingSubmitted(booking);

  return {
    body: {
      booking,
      message: "Your request has been submitted for approval.",
      notifications: notificationSummary,
      trackingCode: booking.trackingCode,
      trackingUrl: `/track?code=${encodeURIComponent(booking.trackingCode)}`,
    },
    statusCode: 201,
  };
}

export async function getBookingTracking(code) {
  const trackingCode = String(code || "").trim().toUpperCase();

  if (!trackingCode) {
    throw new HttpError(400, "Tracking code is required.");
  }

  const bookings = await readBookings();
  const booking = bookings.find((item) => {
    return String(item.trackingCode || "").toUpperCase() === trackingCode;
  });

  if (!booking) {
    throw new HttpError(404, "No request was found for that tracking code.");
  }

  return {
    body: {
      booking: toTrackingView(booking),
    },
    statusCode: 200,
  };
}

export async function listBookingsForAdmin() {
  const bookings = await readBookings();
  const fleet = getFleet();
  const decoratedBookings = bookings.map((booking) => ({
    ...booking,
    availableVehicles:
      booking.status === "pending" || booking.status === "awaiting_payment"
        ? getAvailableVehicles(bookings, booking, fleet, { excludeId: booking.id })
        : [],
  }));

  return {
    body: {
      bookings: [...decoratedBookings].sort((left, right) =>
        right.submittedAt.localeCompare(left.submittedAt),
      ),
      fleet,
    },
    statusCode: 200,
  };
}

export async function getNotificationSettingsForAdmin() {
  return {
    body: {
      settings: await readNotificationSettings(),
    },
    statusCode: 200,
  };
}

export async function getAccessSettingsForAdmin() {
  const settings = await readAccessSettings();

  return {
    body: {
      settings: settings.admin,
    },
    statusCode: 200,
  };
}

export async function updateAccessSettingsForAdmin(input) {
  const settings = await readAccessSettings();
  const nextAdminSettings = validateAccessSettingsInput(input, "admin");
  const nextSettings = await saveAccessSettings({
    ...settings,
    admin: nextAdminSettings,
  });

  return {
    body: {
      message: "Admin credentials updated successfully.",
      settings: nextSettings.admin,
    },
    statusCode: 200,
  };
}

export async function updateNotificationSettingsForAdmin(input) {
  const adminPhones = validateNotificationPhoneList(input.adminPhones, "adminPhones");
  const financePhones = validateNotificationPhoneList(input.financePhones, "financePhones");
  const settings = await saveNotificationSettings({
    adminPhones,
    financePhones,
  });

  return {
    body: {
      message: "Notification contacts saved successfully.",
      settings,
    },
    statusCode: 200,
  };
}

export async function listBookingsForFinance() {
  const bookings = await readBookings();

  return {
    body: {
      bookings: [...bookings].sort((left, right) =>
        right.submittedAt.localeCompare(left.submittedAt),
      ),
    },
    statusCode: 200,
  };
}

export async function getAccessSettingsForFinance() {
  const settings = await readAccessSettings();

  return {
    body: {
      settings: settings.finance,
    },
    statusCode: 200,
  };
}

export async function updateAccessSettingsForFinance(input) {
  const settings = await readAccessSettings();
  const nextFinanceSettings = validateAccessSettingsInput(input, "finance");
  const nextSettings = await saveAccessSettings({
    ...settings,
    finance: nextFinanceSettings,
  });

  return {
    body: {
      message: "Finance credentials updated successfully.",
      settings: nextSettings.finance,
    },
    statusCode: 200,
  };
}

export async function listAvailability() {
  const bookings = await readBookings();
  const approvedBookings = bookings.filter((booking) => booking.status === "approved");

  return {
    body: {
      bookings: approvedBookings.map((booking) => ({
        bookingType: booking.bookingType,
        eventName: booking.eventName,
        fromDate: booking.fromDate || booking.travelDate,
        id: booking.id,
        timeSlot: booking.timeSlot,
        toDate: booking.toDate || booking.travelDate,
      })),
      generatedAt: new Date().toISOString(),
    },
    statusCode: 200,
  };
}

export async function processAdminDecision(id, input) {
  if (!id) {
    throw new HttpError(400, "Booking id is required.");
  }

  const decision = sanitizeDecisionInput(input);

  if (!decision.ok) {
    throw new HttpError(400, "Please provide a valid approval decision.", {
      fields: decision.errors,
    });
  }

  const bookings = await readBookings();
  const fleet = getFleet();
  const current = bookings.find((booking) => booking.id === id);

  if (!current) {
    throw new HttpError(404, "Booking not found.");
  }

  if (!canApplyDecision(current, decision.value.decision)) {
    throw new HttpError(409, getDecisionConflictMessage(current, decision.value.decision), {
      booking: current,
    });
  }

  if (decision.value.decision === "approved") {
    if (current.paymentStatus !== "confirmed") {
      throw new HttpError(409, "Approval blocked until finance confirms payment.", {
        fields: {
          paymentStatus: "Payment must be confirmed by finance before approval.",
        },
      });
    }

    const selectedVehicle = findVehicleById(decision.value.selectedVehicleId, fleet);

    if (!selectedVehicle) {
      throw new HttpError(400, "Please choose a valid bus assignment.", {
        fields: {
          selectedVehicleId: "The selected bus is not available.",
        },
      });
    }

    const availableVehicles = getAvailableVehicles(bookings, current, fleet, {
      excludeId: current.id,
    });

    if (!availableVehicles.some((vehicle) => vehicle.id === selectedVehicle.id)) {
      throw new HttpError(
        409,
        `Approval blocked because ${getVehicleDisplay(selectedVehicle)} is already booked for ${formatSlot(current)}.`,
        {
          fields: {
            selectedVehicleId: "This bus is no longer available for the selected date and slot.",
          },
        },
      );
    }
  }

  const updated = {
    ...current,
    assignedVehicleId:
      decision.value.decision === "approved" ? decision.value.selectedVehicleId : current.assignedVehicleId || "",
    assignedVehicleLabel:
      decision.value.decision === "approved"
        ? getVehicleDisplay(findVehicleById(decision.value.selectedVehicleId, fleet))
        : current.assignedVehicleLabel || "",
    adminNotes: decision.value.adminNotes,
    approvingAuthorityName:
      decision.value.decision === "approved"
        ? decision.value.approvingAuthorityName
        : current.approvingAuthorityName || "",
    driverName: decision.value.decision === "approved" ? decision.value.driverName : current.driverName || "",
    driverPhone: decision.value.decision === "approved" ? decision.value.driverPhone : current.driverPhone || "",
    processedAt: new Date().toISOString(),
    processedBy: decision.value.adminName,
    vehicleRegNo:
      decision.value.decision === "approved"
        ? findVehicleById(decision.value.selectedVehicleId, fleet)?.number || ""
        : current.vehicleRegNo || "",
    status: decision.value.decision,
  };

  await saveBooking(updated);

  const notificationSummary = await notifyBookingDecision(updated);

  return {
    body: {
      booking: updated,
      message: getDecisionMessage(updated.status),
      notifications: notificationSummary,
    },
    statusCode: 200,
  };
}

export async function confirmBookingPayment(id, input) {
  if (!id) {
    throw new HttpError(400, "Booking id is required.");
  }

  const financeName = String(input.financeName || "").trim();
  const paymentReference = String(input.paymentReference || "").trim();
  const paymentNotes = String(input.paymentNotes || "").trim();
  const amountCharged = Number.parseFloat(String(input.amountCharged || "").trim());
  const amountPaid = Number.parseFloat(String(input.amountPaid || "").trim());
  const balance = Number.parseFloat(String(input.balance || "").trim());

  if (!financeName) {
    throw new HttpError(400, "Finance officer name is required.");
  }

  if (!paymentReference) {
    throw new HttpError(400, "Payment reference is required.", {
      fields: {
        paymentReference: "Enter receipt number or transaction reference.",
      },
    });
  }

  if (!Number.isFinite(amountCharged) || amountCharged < 0) {
    throw new HttpError(400, "Amount charged is required.", {
      fields: {
        amountCharged: "Enter a valid amount charged in GH₵.",
      },
    });
  }

  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    throw new HttpError(400, "Amount paid is required.", {
      fields: {
        amountPaid: "Enter a valid amount paid in GH₵.",
      },
    });
  }

  if (!Number.isFinite(balance)) {
    throw new HttpError(400, "Balance is required.", {
      fields: {
        balance: "Enter a valid balance in GH₵.",
      },
    });
  }

  const bookings = await readBookings();
  const current = bookings.find((booking) => booking.id === id);

  if (!current) {
    throw new HttpError(404, "Booking not found.");
  }

  if (current.status !== "awaiting_payment") {
    throw new HttpError(409, "Payment can only be confirmed after admin approves the request to pay.");
  }

  const updated = {
    ...current,
    amountCharged: roundMoney(amountCharged),
    amountPaid: roundMoney(amountPaid),
    balance: roundMoney(balance),
    paymentConfirmedAt: new Date().toISOString(),
    paymentConfirmedBy: financeName,
    paymentNotes,
    paymentReference,
    paymentStatus: "confirmed",
  };

  await saveBooking(updated);

  const notificationSummary = await notifyPaymentConfirmed(updated);

  return {
    body: {
      booking: updated,
      message: "Payment confirmed successfully.",
      notifications: notificationSummary,
    },
    statusCode: 200,
  };
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function validateNotificationPhoneList(value, fieldName) {
  const entries = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter(Boolean);

  const normalized = [];
  const invalid = [];

  for (const entry of entries) {
    const phone = formatGhanaPhoneForStorage(entry);

    if (!phone) {
      invalid.push(entry);
      continue;
    }

    if (!normalized.includes(phone)) {
      normalized.push(phone);
    }
  }

  if (invalid.length > 0) {
    throw new HttpError(400, "Please correct the notification contact numbers.", {
      fields: {
        [fieldName]: `Invalid Ghana number(s): ${invalid.join(", ")}`,
      },
    });
  }

  return normalized;
}

function validateAccessSettingsInput(input, desk) {
  const nameField = desk === "admin" ? "adminName" : "financeName";
  const codeField = "accessCode";
  const nameLabel = desk === "admin" ? "Admin name" : "Finance officer name";
  const accessCodeLabel = desk === "admin" ? "Admin access code" : "Finance access code";
  const normalized = {
    accessCode: String(input?.accessCode || "").trim(),
    name: String(input?.name || input?.[nameField] || "").trim(),
  };
  const fields = {};

  if (!normalized.name) {
    fields[nameField] = `${nameLabel} is required.`;
  }

  if (!normalized.accessCode) {
    fields[codeField] = `${accessCodeLabel} is required.`;
  } else if (normalized.accessCode.length < 6) {
    fields[codeField] = `${accessCodeLabel} must be at least 6 characters.`;
  }

  if (Object.keys(fields).length > 0) {
    throw new HttpError(400, `Please provide a valid ${desk} sign-in configuration.`, {
      fields,
    });
  }

  return normalized;
}

function canApplyDecision(booking, decision) {
  if (booking.status === "pending") {
    return decision === "awaiting_payment" || decision === "declined";
  }

  if (booking.status === "awaiting_payment") {
    return decision === "approved" || decision === "declined";
  }

  return false;
}

function getDecisionConflictMessage(booking, decision) {
  if (booking.status === "awaiting_payment" && decision === "awaiting_payment") {
    return "This request has already been approved for payment.";
  }

  if (booking.status === "pending" && decision === "approved") {
    return "Approve the request to pay before releasing the bus.";
  }

  return "This request has already been processed.";
}

function getDecisionMessage(status) {
  if (status === "awaiting_payment") {
    return "Request approved for payment.";
  }

  if (status === "approved") {
    return "Bus released.";
  }

  return `Booking ${status}.`;
}

function toTrackingView(booking) {
  return {
    adminNotes: booking.adminNotes || "",
    assignedVehicleLabel: booking.assignedVehicleLabel || "",
    balance: booking.balance || 0,
    bookingType: booking.bookingType,
    destination: booking.destination,
    eventName: booking.eventName,
    fromDate: booking.fromDate || booking.travelDate,
    paymentConfirmedAt: booking.paymentConfirmedAt || "",
    paymentStatus: booking.paymentStatus || "pending",
    processedAt: booking.processedAt || "",
    requesterName: booking.requesterName,
    status: booking.status || "pending",
    submittedAt: booking.submittedAt,
    timeSlot: booking.timeSlot,
    toDate: booking.toDate || booking.travelDate,
    trackingCode: booking.trackingCode,
  };
}

function formatSlot(booking) {
  const timeSlotLabel =
    booking.bookingType === "half_day" ? `, ${getTimeSlotLabel(booking.timeSlot)}` : "";
  const fromDate = booking.fromDate || booking.travelDate;
  const toDate = booking.toDate || booking.travelDate;
  const dateLabel = fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;

  return `${dateLabel} (${getBookingTypeLabel(booking.bookingType)}${timeSlotLabel})`;
}
