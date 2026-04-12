import {
  buildBookingRecord,
  getBookingTypeLabel,
  getTimeSlotLabel,
  sanitizeDecisionInput,
  validateBookingRequest,
} from "./bookings.js";
import {
  notifyBookingDecision,
  notifyBookingSubmitted,
} from "./notifications.js";
import { findVehicleById, getAvailableVehicles, getFleet, getVehicleDisplay } from "./fleet.js";
import { HttpError } from "./http.js";
import { readBookings, saveBooking } from "./storage.js";

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
    },
    statusCode: 201,
  };
}

export async function listBookingsForAdmin() {
  const bookings = await readBookings();
  const fleet = getFleet();
  const decoratedBookings = bookings.map((booking) => ({
    ...booking,
    availableVehicles:
      booking.status === "pending"
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

  if (current.status !== "pending") {
    throw new HttpError(409, "This request has already been processed.", {
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
    processedAt: new Date().toISOString(),
    processedBy: decision.value.adminName,
    status: decision.value.decision,
  };

  await saveBooking(updated);

  const notificationSummary = await notifyBookingDecision(updated);

  return {
    body: {
      booking: updated,
      message: `Booking ${updated.status}.`,
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

  const bookings = await readBookings();
  const current = bookings.find((booking) => booking.id === id);

  if (!current) {
    throw new HttpError(404, "Booking not found.");
  }

  if (current.status !== "pending") {
    throw new HttpError(409, "Only pending requests can be payment-confirmed.");
  }

  const updated = {
    ...current,
    paymentConfirmedAt: new Date().toISOString(),
    paymentConfirmedBy: financeName,
    paymentNotes,
    paymentReference,
    paymentStatus: "confirmed",
  };

  await saveBooking(updated);

  return {
    body: {
      booking: updated,
      message: "Payment confirmed successfully.",
    },
    statusCode: 200,
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
