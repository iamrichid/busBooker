import { randomUUID } from "node:crypto";

const VALID_BOOKING_TYPES = new Set(["half_day", "full_day"]);
const VALID_STATUSES = new Set(["pending", "approved", "declined"]);
const VALID_TIME_SLOTS = new Set(["morning", "afternoon", "full_day"]);

export function validateBookingRequest(input) {
  const bookingType = normalizeText(input.bookingType);
  const requestedTimeSlot = normalizeText(input.timeSlot);
  const timeSlot = bookingType === "full_day" ? "full_day" : requestedTimeSlot;
  const value = {
    bookingType,
    destination: normalizeText(input.destination),
    eventName: normalizeText(input.eventName),
    ministryName: normalizeText(input.ministryName),
    notes: normalizeText(input.notes),
    passengerCount: Number.parseInt(String(input.passengerCount || ""), 10),
    phone: normalizeText(input.phone),
    pickupLocation: normalizeText(input.pickupLocation),
    purpose: normalizeText(input.purpose),
    requesterEmail: normalizeText(input.requesterEmail).toLowerCase(),
    requesterName: normalizeText(input.requesterName),
    timeSlot,
    travelDate: normalizeText(input.travelDate),
  };

  const errors = {};

  if (!value.requesterName || value.requesterName.length < 2) {
    errors.requesterName = "Please enter the church member's full name.";
  }

  if (!value.ministryName) {
    errors.ministryName = "Please enter a ministry, department, or fellowship.";
  }

  if (!value.requesterEmail && !value.phone) {
    errors.requesterEmail = "Provide at least an email address or phone number.";
    errors.phone = "Provide at least an email address or phone number.";
  }

  if (value.requesterEmail && !isValidEmail(value.requesterEmail)) {
    errors.requesterEmail = "Please enter a valid email address.";
  }

  if (value.phone && !isValidPhone(value.phone)) {
    errors.phone = "Please enter a valid phone number.";
  }

  if (!value.eventName) {
    errors.eventName = "Please enter the event or activity name.";
  }

  if (!value.purpose) {
    errors.purpose = "Please share the reason for the trip.";
  }

  if (!isValidDate(value.travelDate)) {
    errors.travelDate = "Please choose a valid booking date.";
  } else if (value.travelDate < currentDateString()) {
    errors.travelDate = "Bus requests must be for today or a future date.";
  }

  if (!VALID_BOOKING_TYPES.has(value.bookingType)) {
    errors.bookingType = "Choose either half day or full day.";
  }

  if (value.bookingType === "half_day" && !new Set(["morning", "afternoon"]).has(value.timeSlot)) {
    errors.timeSlot = "Choose morning or afternoon for a half-day booking.";
  }

  if (value.bookingType === "full_day") {
    value.timeSlot = "full_day";
  }

  if (!value.pickupLocation) {
    errors.pickupLocation = "Please enter the pickup location.";
  }

  if (!value.destination) {
    errors.destination = "Please enter the destination.";
  }

  if (!Number.isInteger(value.passengerCount) || value.passengerCount < 1 || value.passengerCount > 60) {
    errors.passengerCount = "Please enter an estimated passenger count between 1 and 60.";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value,
  };
}

export function sanitizeDecisionInput(input) {
  const value = {
    adminName: normalizeText(input.adminName),
    adminNotes: normalizeText(input.adminNotes),
    decision: normalizeText(input.decision),
  };
  const errors = {};

  if (!value.adminName) {
    errors.adminName = "Please enter the approving admin's name.";
  }

  if (!new Set(["approved", "declined"]).has(value.decision)) {
    errors.decision = "Choose approve or decline.";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value,
  };
}

export function buildBookingRecord(value) {
  return {
    ...value,
    id: randomUUID(),
    status: "pending",
    submittedAt: new Date().toISOString(),
  };
}

export function findConflict(bookings, candidate, options = {}) {
  const statuses = new Set(options.statuses || ["approved"]);
  const excludeId = options.excludeId || null;

  return (
    bookings.find((booking) => {
      if (excludeId && booking.id === excludeId) {
        return false;
      }

      if (!statuses.has(booking.status)) {
        return false;
      }

      return hasScheduleConflict(booking, candidate);
    }) || null
  );
}

export function hasScheduleConflict(left, right) {
  if (left.travelDate !== right.travelDate) {
    return false;
  }

  if (left.timeSlot === "full_day" || right.timeSlot === "full_day") {
    return true;
  }

  return left.timeSlot === right.timeSlot;
}

export function getBookingTypeLabel(bookingType) {
  return bookingType === "full_day" ? "Full day" : "Half day";
}

export function getStatusLabel(status) {
  if (!VALID_STATUSES.has(status)) {
    return "Unknown";
  }

  return `${status.slice(0, 1).toUpperCase()}${status.slice(1)}`;
}

export function getTimeSlotLabel(timeSlot) {
  if (!VALID_TIME_SLOTS.has(timeSlot)) {
    return "Unknown slot";
  }

  if (timeSlot === "full_day") {
    return "All day";
  }

  return timeSlot === "morning" ? "Morning" : "Afternoon";
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(timestamp);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  return /^[+\d][\d\s()-]{6,}$/.test(value);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function currentDateString() {
  return new Date().toISOString().slice(0, 10);
}
