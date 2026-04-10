import test from "node:test";
import assert from "node:assert/strict";

import {
  findConflict,
  hasScheduleConflict,
  sanitizeDecisionInput,
  validateBookingRequest,
} from "../src/bookings.js";

const validBooking = {
  bookingType: "half_day",
  destination: "Kasoa prayer center",
  eventName: "Choir outreach",
  fromDate: "2099-08-15",
  memberStatus: "yes",
  membershipNumber: "PCG-4421",
  ministryName: "Choir",
  notes: "",
  phone: "0241234567",
  pickupLocation: "Church auditorium",
  purpose: "Transport choir team for ministry.",
  requesterEmail: "choir@church.org",
  requesterName: "Martha Owusu",
  timeSlot: "morning",
  toDate: "2099-08-15",
};

test("validateBookingRequest accepts a complete future booking", () => {
  const result = validateBookingRequest(validBooking);
  assert.equal(result.ok, true);
  assert.equal(result.value.timeSlot, "morning");
});

test("validateBookingRequest accepts a booking with only one contact method", () => {
  const result = validateBookingRequest({
    ...validBooking,
    requesterEmail: "",
  });

  assert.equal(result.ok, true);
});

test("validateBookingRequest requires a membership number for members", () => {
  const result = validateBookingRequest({
    ...validBooking,
    membershipNumber: "",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.membershipNumber, "Please provide your membership number.");
});

test("validateBookingRequest rejects non-members", () => {
  const result = validateBookingRequest({
    ...validBooking,
    memberStatus: "no",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.memberStatus, "This booking form is only for church members.");
});

test("validateBookingRequest enforces 10-digit Ghana phone numbers", () => {
  const result = validateBookingRequest({
    ...validBooking,
    phone: "247820735",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.phone, "Please enter a valid 10-digit Ghana phone number.");
});

test("validateBookingRequest requires a slot for half-day bookings", () => {
  const result = validateBookingRequest({
    ...validBooking,
    timeSlot: "",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.timeSlot, "Choose morning or afternoon for a half-day booking.");
});

test("validateBookingRequest coerces full-day bookings to a full-day slot", () => {
  const result = validateBookingRequest({
    ...validBooking,
    bookingType: "full_day",
    timeSlot: "morning",
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.timeSlot, "full_day");
});

test("hasScheduleConflict matches same day and slot", () => {
  assert.equal(
    hasScheduleConflict(
      { fromDate: "2099-08-15", toDate: "2099-08-15", timeSlot: "morning" },
      { fromDate: "2099-08-15", toDate: "2099-08-15", timeSlot: "morning" },
    ),
    true,
  );
});

test("hasScheduleConflict blocks any booking against a full-day booking", () => {
  assert.equal(
    hasScheduleConflict(
      { fromDate: "2099-08-15", toDate: "2099-08-15", timeSlot: "full_day" },
      { fromDate: "2099-08-15", toDate: "2099-08-15", timeSlot: "afternoon" },
    ),
    true,
  );
});

test("hasScheduleConflict detects overlap inside a multi-day range", () => {
  assert.equal(
    hasScheduleConflict(
      { fromDate: "2099-08-15", toDate: "2099-08-18", timeSlot: "morning" },
      { fromDate: "2099-08-17", toDate: "2099-08-20", timeSlot: "morning" },
    ),
    true,
  );
});

test("hasScheduleConflict ignores non-overlapping date ranges", () => {
  assert.equal(
    hasScheduleConflict(
      { fromDate: "2099-08-15", toDate: "2099-08-16", timeSlot: "morning" },
      { fromDate: "2099-08-17", toDate: "2099-08-18", timeSlot: "morning" },
    ),
    false,
  );
});

test("findConflict ignores non-approved bookings by default", () => {
  const result = findConflict(
    [
      {
        id: "1",
        status: "pending",
        fromDate: "2099-08-15",
        toDate: "2099-08-15",
        timeSlot: "morning",
      },
    ],
    {
      id: "2",
      fromDate: "2099-08-15",
      toDate: "2099-08-15",
      timeSlot: "morning",
    },
  );

  assert.equal(result, null);
});

test("sanitizeDecisionInput requires admin name and valid decision", () => {
  const result = sanitizeDecisionInput({
    adminName: "",
    decision: "later",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.adminName);
  assert.ok(result.errors.decision);
});

test("sanitizeDecisionInput requires a bus assignment before approval", () => {
  const result = sanitizeDecisionInput({
    adminName: "Admin",
    decision: "approved",
    selectedVehicleId: "",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.selectedVehicleId, "Please assign a bus before approval.");
});
