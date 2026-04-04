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
  ministryName: "Choir",
  notes: "",
  passengerCount: "24",
  phone: "+233 24 123 4567",
  pickupLocation: "Church auditorium",
  purpose: "Transport choir team for ministry.",
  requesterEmail: "choir@church.org",
  requesterName: "Martha Owusu",
  timeSlot: "morning",
  travelDate: "2099-08-15",
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
      { travelDate: "2099-08-15", timeSlot: "morning" },
      { travelDate: "2099-08-15", timeSlot: "morning" },
    ),
    true,
  );
});

test("hasScheduleConflict blocks any booking against a full-day booking", () => {
  assert.equal(
    hasScheduleConflict(
      { travelDate: "2099-08-15", timeSlot: "full_day" },
      { travelDate: "2099-08-15", timeSlot: "afternoon" },
    ),
    true,
  );
});

test("findConflict ignores non-approved bookings by default", () => {
  const result = findConflict(
    [
      {
        id: "1",
        status: "pending",
        travelDate: "2099-08-15",
        timeSlot: "morning",
      },
    ],
    {
      id: "2",
      travelDate: "2099-08-15",
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
