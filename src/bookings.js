import { randomUUID } from "node:crypto";

const VALID_BOOKING_TYPES = new Set(["half_day", "full_day"]);
const VALID_STATUSES = new Set(["pending", "approved", "declined"]);
const VALID_TIME_SLOTS = new Set(["morning", "afternoon", "full_day"]);

export function validateBookingRequest(input) {
  const bookingType = normalizeText(input.bookingType);
  const memberStatus = normalizeText(input.memberStatus).toLowerCase();
  const requestedTimeSlot = normalizeText(input.timeSlot);
  const timeSlot = bookingType === "full_day" ? "full_day" : requestedTimeSlot;
  const phone = normalizePhone(input.phone);
  const value = {
    bookingType,
    destination: normalizeText(input.destination),
    eventName: normalizeText(input.eventName),
    fromDate: normalizeText(input.fromDate || input.travelDate),
    memberStatus,
    membershipNumber: normalizeText(input.membershipNumber),
    ministryName: normalizeText(input.ministryName),
    notes: normalizeText(input.notes),
    phone,
    pickupLocation: normalizeText(input.pickupLocation),
    purpose: normalizeText(input.purpose),
    requesterEmail: normalizeText(input.requesterEmail).toLowerCase(),
    requesterName: normalizeText(input.requesterName),
    timeSlot,
    toDate: normalizeText(input.toDate || input.travelDate),
  };

  const errors = {};

  if (!value.requesterName || value.requesterName.length < 2) {
    errors.requesterName = "Please enter the church member's full name.";
  }

  if (!new Set(["yes", "no"]).has(value.memberStatus)) {
    errors.memberStatus = "Please choose whether you are a church member.";
  }

  if (value.memberStatus === "yes" && !value.membershipNumber) {
    errors.membershipNumber = "Please provide your membership number.";
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
    errors.phone = "Please enter a valid 10-digit Ghana phone number.";
  }

  if (!value.eventName) {
    errors.eventName = "Please enter the event or activity name.";
  }

  if (!value.purpose) {
    errors.purpose = "Please share the reason for the trip.";
  }

  if (!isValidDate(value.fromDate)) {
    errors.fromDate = "Please choose a valid start date.";
  } else if (value.fromDate < currentDateString()) {
    errors.fromDate = "Bus requests must start today or a future date.";
  }

  if (!isValidDate(value.toDate)) {
    errors.toDate = "Please choose a valid end date.";
  } else if (isValidDate(value.fromDate) && value.toDate < value.fromDate) {
    errors.toDate = "End date cannot be earlier than start date.";
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
    selectedVehicleId: normalizeText(input.selectedVehicleId),
  };
  const errors = {};

  if (!value.adminName) {
    errors.adminName = "Please enter the approving admin's name.";
  }

  if (!new Set(["approved", "declined"]).has(value.decision)) {
    errors.decision = "Choose approve or decline.";
  }

  if (value.decision === "approved" && !value.selectedVehicleId) {
    errors.selectedVehicleId = "Please assign a bus before approval.";
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
  const leftRange = getDateRange(left);
  const rightRange = getDateRange(right);

  if (!leftRange || !rightRange) {
    return false;
  }

  if (leftRange.start > rightRange.end || rightRange.start > leftRange.end) {
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

function getDateRange(booking) {
  const start = normalizeText(booking.fromDate || booking.travelDate);
  const end = normalizeText(booking.toDate || booking.travelDate);

  if (!isValidDate(start) || !isValidDate(end)) {
    return null;
  }

  if (end < start) {
    return null;
  }

  return { start, end };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  return /^0\d{9}$/.test(value);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

function currentDateString() {
  return new Date().toISOString().slice(0, 10);
}
