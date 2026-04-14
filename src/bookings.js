import { randomUUID } from "node:crypto";

const VALID_BOOKING_TYPES = new Set(["half_day", "full_day"]);
const VALID_STATUSES = new Set(["pending", "awaiting_payment", "approved", "declined"]);
const VALID_TIME_SLOTS = new Set(["morning", "afternoon", "full_day"]);

export function validateBookingRequest(input) {
  const bookingType = normalizeText(input.bookingType);
  const memberStatus = normalizeText(input.memberStatus).toLowerCase();
  const requestedTimeSlot = normalizeText(input.timeSlot);
  const timeSlot = bookingType === "full_day" ? "full_day" : requestedTimeSlot;
  const pickupLocation = normalizeText(input.pickupLocation);
  const endLocationMode = normalizeText(input.endLocationMode || "same_as_setoff");
  const endLocationRaw = normalizeText(input.endLocation);
  const phone = normalizePhone(input.phone);
  const passengerCount = Number.parseInt(String(input.passengerCount || ""), 10);
  const termsAccepted = normalizeBoolean(input.termsAccepted);
  const organizationName = normalizeText(input.organizationName || input.ministryName);
  const value = {
    address: normalizeText(input.address),
    bookingType,
    destination: normalizeText(input.destination),
    endDate: normalizeText(input.toDate || input.travelDate),
    endLocation: endLocationMode === "same_as_setoff" ? pickupLocation : endLocationRaw,
    endLocationMode,
    endTime: normalizeText(input.endTime),
    eventName: normalizeText(input.eventName),
    fixedLine: normalizeDigits(input.fixedLine, 10),
    fromDate: normalizeText(input.fromDate || input.travelDate),
    memberStatus,
    membershipNumber: normalizeText(input.membershipNumber),
    ministryName: organizationName,
    notes: normalizeText(input.notes),
    organizationName,
    passengerCount,
    phone,
    pickupLocation: normalizeText(input.pickupLocation),
    purpose: normalizeText(input.purpose),
    declarationDate: normalizeText(input.declarationDate),
    declarationName: normalizeText(input.declarationName),
    requesterEmail: normalizeText(input.requesterEmail).toLowerCase(),
    requesterName: normalizeText(input.requesterName),
    startDate: normalizeText(input.fromDate || input.travelDate),
    startTime: normalizeText(input.startTime),
    termsAccepted,
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

  if (!value.organizationName) {
    errors.organizationName = "Please enter the organisation or ministry name.";
  }

  if (!value.requesterEmail) {
    errors.requesterEmail = "Email address is required.";
  } else if (!isValidEmail(value.requesterEmail)) {
    errors.requesterEmail = "Please enter a valid email address.";
  }

  if (!value.phone || !isValidPhone(value.phone)) {
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

  if (!value.startTime) {
    errors.startTime = "Please choose a valid start time.";
  }

  if (!value.endTime) {
    errors.endTime = "Please choose a valid end time.";
  } else if (value.fromDate === value.toDate && value.startTime && value.endTime <= value.startTime) {
    errors.endTime = "End time must be later than start time for same-day trips.";
  }

  if (!Number.isInteger(value.passengerCount) || value.passengerCount < 1) {
    errors.passengerCount = "Please enter the number of people.";
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

  if (!new Set(["same_as_setoff", "other"]).has(value.endLocationMode)) {
    errors.endLocationMode = "Please choose the end location mode.";
  }

  if (value.endLocationMode === "other" && !value.endLocation) {
    errors.endLocation = "Please provide the end location.";
  }

  if (!value.destination) {
    errors.destination = "Please enter the destination.";
  }

  if (!value.termsAccepted) {
    errors.termsAccepted = "You must accept the transport terms before submitting.";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value,
  };
}

export function sanitizeDecisionInput(input) {
  const value = {
    approvingAuthorityName: normalizeText(input.approvingAuthorityName || input.adminName),
    adminName: normalizeText(input.adminName),
    adminNotes: normalizeText(input.adminNotes),
    decision: normalizeText(input.decision),
    driverName: normalizeText(input.driverName),
    driverPhone: normalizeDigits(input.driverPhone, 10),
    selectedVehicleId: normalizeText(input.selectedVehicleId),
  };
  const errors = {};

  if (!value.adminName) {
    errors.adminName = "Please enter the approving admin's name.";
  }

  if (!new Set(["awaiting_payment", "approved", "declined"]).has(value.decision)) {
    errors.decision = "Choose approve or decline.";
  }

  if (value.decision === "approved" && !value.selectedVehicleId) {
    errors.selectedVehicleId = "Please assign a bus before approval.";
  }

  if (value.decision === "approved" && !value.driverName) {
    errors.driverName = "Please provide the assigned driver's name.";
  }

  if (value.decision === "approved" && !/^0\d{9}$/.test(value.driverPhone)) {
    errors.driverPhone = "Please enter a valid 10-digit driver phone number.";
  }

  if (value.decision === "approved" && !value.approvingAuthorityName) {
    errors.approvingAuthorityName = "Please enter the approving authority name.";
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
    amountCharged: 0,
    amountPaid: 0,
    balance: 0,
    driverName: "",
    driverPhone: "",
    id: randomUUID(),
    paymentConfirmedAt: "",
    paymentConfirmedBy: "",
    paymentNotes: "",
    paymentReference: "",
    paymentStatus: "pending",
    vehicleRegNo: "",
    status: "pending",
    submittedAt: new Date().toISOString(),
    trackingCode: createTrackingCode(),
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

  if (status === "awaiting_payment") {
    return "Awaiting payment";
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

function normalizeDigits(value, maxLength) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, maxLength);
}

function normalizeBoolean(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "on" || normalized === "true" || normalized === "yes" || normalized === "1";
}

function createTrackingCode() {
  return `BUS-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function currentDateString() {
  return new Date().toISOString().slice(0, 10);
}
