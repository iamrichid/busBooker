import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBookingRecord,
  findConflict,
  hasScheduleConflict,
  sanitizeDecisionInput,
  validateBookingRequest,
} from "../src/bookings.js";

const validBooking = {
  destinationRegionId: "kasoa",
  destinationDetail: "Prayer centre",
  endLocation: "Church auditorium",
  endLocationMode: "same_as_setoff",
  endTime: "16:30",
  eventName: "Choir outreach",
  fromDate: "2099-08-15",
  memberStatus: "yes",
  membershipNumber: "PCG-4421",
  organizationName: "Choir",
  notes: "",
  passengerCount: 24,
  phone: "0241234567",
  pickupLocation: "Church auditorium",
  purpose: "Transport choir team for ministry.",
  requesterEmail: "choir@church.org",
  requesterName: "Martha Owusu",
  startTime: "08:30",
  termsAccepted: "on",
  toDate: "2099-08-15",
};

test("validateBookingRequest accepts a complete future booking", () => {
  const result = validateBookingRequest(validBooking);
  assert.equal(result.ok, true);
  assert.equal(result.value.startTime, "08:30");
});

test("validateBookingRequest attaches hiring rate from destination region", () => {
  const result = validateBookingRequest(validBooking);
  assert.equal(result.ok, true);
  assert.equal(result.value.hireRateGhs, 1000);
  assert.equal(result.value.destinationRegionLabel, "Kasoa");
  assert.match(result.value.destination, /Kasoa/);
  assert.match(result.value.destination, /Prayer centre/);
});

test("validateBookingRequest rejects unknown destination region", () => {
  const result = validateBookingRequest({
    ...validBooking,
    destinationRegionId: "unknown-place",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.destinationRegionId);
});

test("buildBookingRecord creates a public tracking code", () => {
  const result = validateBookingRequest(validBooking);
  const record = buildBookingRecord(result.value);

  assert.match(record.trackingCode, /^BUS-[A-F0-9]{8}$/);
});

test("validateBookingRequest requires email address", () => {
  const result = validateBookingRequest({
    ...validBooking,
    requesterEmail: "",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.requesterEmail, "Email address is required.");
});

test("validateBookingRequest requires a membership number for members", () => {
  const result = validateBookingRequest({
    ...validBooking,
    membershipNumber: "",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.membershipNumber, "Please provide your membership number.");
});

test("validateBookingRequest allows non-members", () => {
  const result = validateBookingRequest({
    ...validBooking,
    memberStatus: "no",
    membershipNumber: "",
  });

  assert.equal(result.ok, true);
});

test("validateBookingRequest enforces 10-digit Ghana phone numbers", () => {
  const result = validateBookingRequest({
    ...validBooking,
    phone: "247820735",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.phone, "Please enter a valid 10-digit Ghana phone number.");
});

test("validateBookingRequest requires a start time", () => {
  const result = validateBookingRequest({
    ...validBooking,
    startTime: "",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.startTime, "Please choose a valid start time.");
});

test("validateBookingRequest rejects same-day end times earlier than start time", () => {
  const result = validateBookingRequest({
    ...validBooking,
    endTime: "08:00",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.endTime, "End time must be later than start time for same-day trips.");
});

test("validateBookingRequest rejects end date before start date", () => {
  const result = validateBookingRequest({
    ...validBooking,
    fromDate: "2099-08-20",
    toDate: "2099-08-19",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.toDate, "End date cannot be earlier than start date.");
});

test("hasScheduleConflict matches same day overlapping times", () => {
  assert.equal(
    hasScheduleConflict(
      { fromDate: "2099-08-15", toDate: "2099-08-15", startTime: "08:00", endTime: "12:00" },
      { fromDate: "2099-08-15", toDate: "2099-08-15", startTime: "10:00", endTime: "13:00" },
    ),
    true,
  );
});

test("hasScheduleConflict ignores same day bookings with separated times", () => {
  assert.equal(
    hasScheduleConflict(
      { fromDate: "2099-08-15", toDate: "2099-08-15", startTime: "08:00", endTime: "10:00" },
      { fromDate: "2099-08-15", toDate: "2099-08-15", startTime: "10:00", endTime: "12:00" },
    ),
    false,
  );
});

test("hasScheduleConflict detects overlap inside a multi-day range", () => {
  assert.equal(
    hasScheduleConflict(
      { fromDate: "2099-08-15", toDate: "2099-08-18", startTime: "08:00", endTime: "16:00" },
      { fromDate: "2099-08-17", toDate: "2099-08-20", startTime: "09:00", endTime: "12:00" },
    ),
    true,
  );
});

test("hasScheduleConflict ignores non-overlapping date ranges", () => {
  assert.equal(
    hasScheduleConflict(
      { fromDate: "2099-08-15", toDate: "2099-08-16", startTime: "08:00", endTime: "09:00" },
      { fromDate: "2099-08-17", toDate: "2099-08-18", startTime: "08:00", endTime: "09:00" },
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
        startTime: "08:00",
        endTime: "10:00",
      },
    ],
    {
      id: "2",
      fromDate: "2099-08-15",
      toDate: "2099-08-15",
      startTime: "09:00",
      endTime: "11:00",
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

test("sanitizeDecisionInput allows approval to proceed to payment without bus release details", () => {
  const result = sanitizeDecisionInput({
    adminName: "Admin",
    decision: "awaiting_payment",
  });

  assert.equal(result.ok, true);
});
