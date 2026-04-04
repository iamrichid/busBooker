import {
  buildBookingRecord,
  findConflict,
  getBookingTypeLabel,
  getTimeSlotLabel,
  sanitizeDecisionInput,
  validateBookingRequest,
} from "./bookings.js";
import {
  notifyBookingDecision,
  notifyBookingSubmitted,
} from "./notifications.js";
import { HttpError } from "./http.js";
import { readBookings, saveBooking } from "./storage.js";

export async function submitBookingRequest(input) {
  const validation = validateBookingRequest(input);

  if (!validation.ok) {
    throw new HttpError(400, "Please correct the highlighted booking details.", {
      fields: validation.errors,
    });
  }

  const bookings = await readBookings();
  const booking = buildBookingRecord(validation.value);
  const conflict = findConflict(bookings, booking, { statuses: ["approved"] });

  if (conflict) {
    throw new HttpError(409, `The bus is already booked for ${formatSlot(conflict)}.`, {
      conflict,
    });
  }

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

  return {
    body: {
      bookings: [...bookings].sort((left, right) =>
        right.submittedAt.localeCompare(left.submittedAt),
      ),
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
    const conflict = findConflict(bookings, current, {
      excludeId: current.id,
      statuses: ["approved"],
    });

    if (conflict) {
      throw new HttpError(
        409,
        `Approval blocked because the bus is already booked for ${formatSlot(conflict)}.`,
        { conflict },
      );
    }
  }

  const updated = {
    ...current,
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

function formatSlot(booking) {
  const timeSlotLabel =
    booking.bookingType === "half_day" ? `, ${getTimeSlotLabel(booking.timeSlot)}` : "";

  return `${booking.travelDate} (${getBookingTypeLabel(booking.bookingType)}${timeSlotLabel})`;
}
