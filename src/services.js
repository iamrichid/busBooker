import {
  buildBookingRecord,
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
  readBookings,
  readHiringRatesDocument,
  readNotificationSettings,
  readSmsCreditStatus,
  readTermsDocument,
  saveBooking,
  saveHiringRatesDocument,
  saveNotificationSettings,
  saveTermsDocument,
} from "./storage.js";
import {
  applyHiringRatesSnapshot,
  DEFAULT_HIRING_ROUTES,
  listHiringRatesForApi,
  mergeHiringRatesSubmission,
} from "./hiring-rates.js";
import { PAYMENT_MOMO_NAME, PAYMENT_MOMO_NUMBER } from "./payment.js";

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

export async function submitBookingPaymentReference(code, input) {
  const trackingCode = String(code || "").trim().toUpperCase();
  const paymentReference = String(input.paymentReference || "").trim();

  if (!trackingCode) {
    throw new HttpError(400, "Tracking code is required.");
  }

  if (!paymentReference) {
    throw new HttpError(400, "Transaction ID is required.", {
      fields: {
        paymentReference: "Enter the MoMo transaction ID after payment.",
      },
    });
  }

  const bookings = await readBookings();
  const current = bookings.find((item) => String(item.trackingCode || "").toUpperCase() === trackingCode);

  if (!current) {
    throw new HttpError(404, "No request was found for that tracking code.");
  }

  if (current.status !== "awaiting_payment") {
    throw new HttpError(409, "Transaction IDs can only be submitted after admin approves the request to pay.");
  }

  if (current.paymentStatus === "confirmed") {
    throw new HttpError(409, "Finance has already confirmed payment for this booking.");
  }

  const updated = {
    ...current,
    paymentReference,
    paymentSubmittedAt: new Date().toISOString(),
    paymentStatus: "submitted",
  };

  await saveBooking(updated);

  return {
    body: {
      booking: toTrackingView(updated),
      message: "Transaction ID submitted successfully. Finance will verify and confirm payment.",
    },
    statusCode: 200,
  };
}

export async function listBookingsForAdmin() {
  const bookings = await readBookings();
  const fleet = getFleet();
  const smsCredits = await readSmsCreditStatus();
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
      smsCredits,
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

export async function getTermsDocument() {
  return {
    body: {
      terms: await readTermsDocument(),
    },
    statusCode: 200,
  };
}

export async function getTermsDocumentForAdmin() {
  return {
    body: {
      terms: await readTermsDocument(),
    },
    statusCode: 200,
  };
}

export async function updateTermsDocumentForAdmin(input) {
  const content = String(input.content || "").trim();
  const fileName = String(input.fileName || "").trim() || "uploaded-terms.txt";
  const updatedBy = String(input.updatedBy || "").trim();

  if (!content) {
    throw new HttpError(400, "Terms content is required.", {
      fields: {
        content: "Upload or enter the terms text before saving.",
      },
    });
  }

  const terms = await saveTermsDocument({
    content,
    fileName,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });

  return {
    body: {
      message: "Terms and conditions saved successfully.",
      terms,
    },
    statusCode: 200,
  };
}

export async function getHiringRatesForAdmin() {
  const doc = await readHiringRatesDocument();

  return {
    body: {
      ...listHiringRatesForApi(),
      savedAt: doc?.updatedAt || "",
      savedBy: doc?.updatedBy || "",
    },
    statusCode: 200,
  };
}

export async function updateHiringRatesForAdmin(input) {
  const updatedBy = String(input?.updatedBy || "").trim();
  const reset = Boolean(input?.reset);

  let routes;
  if (reset) {
    routes = JSON.parse(JSON.stringify(DEFAULT_HIRING_ROUTES));
  } else {
    const merged = mergeHiringRatesSubmission(input?.routes);
    if (!merged.ok) {
      throw new HttpError(400, "Please correct the highlighted hiring rate fields.", {
        fields: merged.errors,
      });
    }

    routes = merged.routes;
  }

  const saved = await saveHiringRatesDocument({
    routes,
    updatedAt: new Date().toISOString(),
    updatedBy: reset ? `${updatedBy} (reset to defaults)` : updatedBy,
  });

  applyHiringRatesSnapshot(saved.routes);

  return {
    body: {
      message: reset
        ? "Hiring rates were reset to the built-in defaults and saved."
        : "Hiring rates saved successfully.",
      hiringRates: listHiringRatesForApi(),
      savedAt: saved.updatedAt,
      savedBy: saved.updatedBy,
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

export async function listAvailability() {
  const bookings = await readBookings();
  const approvedBookings = bookings.filter((booking) => booking.status === "approved");

  return {
    body: {
      bookings: approvedBookings.map((booking) => ({
        eventName: booking.eventName,
        fromDate: booking.fromDate || booking.travelDate,
        id: booking.id,
        startTime: booking.startTime,
        toDate: booking.toDate || booking.travelDate,
        endTime: booking.endTime,
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

export async function markBookingReturned(id, input) {
  if (!id) {
    throw new HttpError(400, "Booking id is required.");
  }

  const adminName = String(input.adminName || "").trim();

  if (!adminName) {
    throw new HttpError(400, "Admin name is required.");
  }

  const bookings = await readBookings();
  const current = bookings.find((booking) => booking.id === id);

  if (!current) {
    throw new HttpError(404, "Booking not found.");
  }

  if (current.status !== "approved") {
    throw new HttpError(409, "Only released bookings can be marked as returned.");
  }

  if (current.returnedAt) {
    throw new HttpError(409, "This bus has already been marked as returned.");
  }

  const updated = {
    ...current,
    returnedAt: new Date().toISOString(),
    returnedBy: adminName,
  };

  await saveBooking(updated);

  return {
    body: {
      booking: updated,
      message: "Bus marked as returned and available again.",
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
    destination: booking.destination,
    eventName: booking.eventName,
    paymentInstructionsName: PAYMENT_MOMO_NAME,
    fromDate: booking.fromDate || booking.travelDate,
    paymentInstructionsNumber: PAYMENT_MOMO_NUMBER,
    paymentConfirmedAt: booking.paymentConfirmedAt || "",
    paymentReference: booking.paymentReference || "",
    paymentSubmittedAt: booking.paymentSubmittedAt || "",
    paymentStatus: booking.paymentStatus || "pending",
    processedAt: booking.processedAt || "",
    requesterName: booking.requesterName,
    returnedAt: booking.returnedAt || "",
    startTime: booking.startTime || "",
    status: booking.status || "pending",
    submittedAt: booking.submittedAt,
    toDate: booking.toDate || booking.travelDate,
    endTime: booking.endTime || "",
    trackingCode: booking.trackingCode,
  };
}

function formatSlot(booking) {
  const fromDate = booking.fromDate || booking.travelDate;
  const toDate = booking.toDate || booking.travelDate;
  const startTime = booking.startTime || "--:--";
  const endTime = booking.endTime || "--:--";
  const dateLabel = fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;

  return `${dateLabel} (${startTime} to ${endTime})`;
}
