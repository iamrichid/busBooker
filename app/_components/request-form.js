"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GHANA_PHONE_PATTERN = /^0\d{9}$/;

function createInitialState(fromDate = "", toDate = "") {
  return {
    bookingType: "half_day",
    destination: "",
    endLocation: "",
    endLocationMode: "same_as_setoff",
    endTime: "",
    eventName: "",
    fromDate,
    memberStatus: "yes",
    membershipNumber: "",
    notes: "",
    organizationName: "",
    passengerCount: "",
    phone: "",
    pickupLocation: "",
    purpose: "",
    requesterEmail: "",
    requesterName: "",
    startTime: "",
    termsAccepted: false,
    timeSlot: "morning",
    toDate: toDate || fromDate,
  };
}

export default function RequestForm({ initialFromDate = "", initialToDate = "" }) {
  const router = useRouter();
  const today = useMemo(() => currentLocalDateString(), []);
  const [form, setForm] = useState(() => createInitialState(initialFromDate, initialToDate));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ text: "", tone: "" });
  const [submitting, setSubmitting] = useState(false);

  const isMember = form.memberStatus === "yes";
  const isFullDay = form.bookingType === "full_day";
  const showEndLocation = form.endLocationMode === "other";
  const toDateMin = form.fromDate || today;
  const endTimeMin = form.fromDate && form.toDate && form.fromDate === form.toDate ? form.startTime || "" : "";

  const setField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "memberStatus" && value !== "yes") {
        next.membershipNumber = "";
      }

      if (field === "bookingType") {
        next.timeSlot = value === "full_day" ? "full_day" : "morning";
      }

      if (field === "endLocationMode" && value !== "other") {
        next.endLocation = "";
      }

      if (field === "fromDate") {
        if (next.toDate && next.toDate < value) {
          next.toDate = value;
        }
      }

      return next;
    });

    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = normalizePayload(form);
    const nextErrors = validatePayload(payload);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setMessage({ text: "Please correct the highlighted fields.", tone: "error" });
      return;
    }

    setSubmitting(true);
    setErrors({});
    setMessage({ text: "Submitting your request...", tone: "neutral" });

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrors(result.fields || {});
        setMessage({ text: result.error || "We could not submit your request.", tone: "error" });
        return;
      }

      if (result.trackingUrl) {
        router.push(result.trackingUrl);
        return;
      }

      const notificationNotes = (result.notifications?.results || [])
        .map((entry) => `${entry.channel}: ${entry.status}`)
        .join(" | ");

      setForm(createInitialState("", ""));
      setMessage({
        text: `${result.message}${notificationNotes ? ` Notification status: ${notificationNotes}.` : ""}`,
        tone: "success",
      });
    } catch (error) {
      setMessage({ text: error.message || "The server could not be reached.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel request-panel">
      <p className="panel-copy request-intro">
        Fill in the trip details below and the transport team will review the request before approval.
      </p>

      <form id="booking-form" className="booking-form" noValidate onSubmit={handleSubmit}>
        <div className="full-width request-section">
          <h2>Contact Information</h2>
          <p>All fields below are mandatory for submission.</p>
        </div>

        <Field label="Are you a church member?" error={errors.memberStatus}>
          <select
            id="memberStatus"
            name="memberStatus"
            required
            value={form.memberStatus}
            onChange={(event) => setField("memberStatus", event.target.value)}
          >
            <option value="yes">Yes, I am a member</option>
            <option value="no">No</option>
          </select>
        </Field>

        <Field label="Membership number" error={errors.membershipNumber} id="membershipNumberWrap" hidden={!isMember}>
          <input
            name="membershipNumber"
            type="text"
            maxLength="32"
            autoComplete="off"
            placeholder="Enter membership number"
            value={form.membershipNumber}
            onChange={(event) => setField("membershipNumber", event.target.value)}
            required={isMember}
          />
        </Field>

        <Field label="Full name" error={errors.requesterName}>
          <input
            name="requesterName"
            type="text"
            autoComplete="name"
            placeholder="Martha Owusu"
            required
            value={form.requesterName}
            onChange={(event) => setField("requesterName", event.target.value)}
          />
        </Field>

        <Field label="Name of organisation" error={errors.organizationName}>
          <input
            name="organizationName"
            type="text"
            autoComplete="organization"
            placeholder="Youth Ministry / External Organisation"
            required
            value={form.organizationName}
            onChange={(event) => setField("organizationName", event.target.value)}
          />
        </Field>

        <Field label="Email address" error={errors.requesterEmail}>
          <input
            id="requesterEmail"
            name="requesterEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="member@yourchurch.org"
            required
            value={form.requesterEmail}
            onChange={(event) => setField("requesterEmail", event.target.value)}
          />
        </Field>

        <Field label="Mobile number" error={errors.phone}>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            maxLength="10"
            autoComplete="tel"
            placeholder="0241234567"
            required
            value={form.phone}
            onChange={(event) => setField("phone", event.target.value.replace(/\D/g, "").slice(0, 10))}
          />
        </Field>

        <Field label="Event name" error={errors.eventName}>
          <input
            name="eventName"
            type="text"
            placeholder="Choir outreach"
            required
            value={form.eventName}
            onChange={(event) => setField("eventName", event.target.value)}
          />
        </Field>

        <div className="full-width request-section">
          <h2>Journey Details</h2>
          <p>Provide full date, time, and location details.</p>
        </div>

        <Field label="Purpose" error={errors.purpose}>
          <textarea
            name="purpose"
            rows="3"
            placeholder="Describe why the bus is needed."
            required
            value={form.purpose}
            onChange={(event) => setField("purpose", event.target.value)}
          />
        </Field>

        <Field label="Destination(s)" error={errors.destination}>
          <input
            name="destination"
            type="text"
            placeholder="Kasoa prayer center"
            required
            value={form.destination}
            onChange={(event) => setField("destination", event.target.value)}
          />
        </Field>

        <Field label="Set-off location" error={errors.pickupLocation}>
          <input
            name="pickupLocation"
            type="text"
            placeholder="Church auditorium"
            required
            value={form.pickupLocation}
            onChange={(event) => setField("pickupLocation", event.target.value)}
          />
        </Field>

        <Field label="End location mode" error={errors.endLocationMode}>
          <select
            id="endLocationMode"
            name="endLocationMode"
            required
            value={form.endLocationMode}
            onChange={(event) => setField("endLocationMode", event.target.value)}
          >
            <option value="same_as_setoff">Same as set-off</option>
            <option value="other">Other location</option>
          </select>
        </Field>

        <Field label="End location" error={errors.endLocation} id="endLocationWrap" hidden={!showEndLocation}>
          <input
            name="endLocation"
            type="text"
            placeholder="Enter end location"
            value={form.endLocation}
            onChange={(event) => setField("endLocation", event.target.value)}
            required={showEndLocation}
          />
        </Field>

        <Field label="From date" error={errors.fromDate}>
          <input
            id="fromDate"
            name="fromDate"
            type="date"
            min={today}
            required
            value={form.fromDate}
            onChange={(event) => setField("fromDate", event.target.value)}
          />
        </Field>

        <Field label="Start time" error={errors.startTime}>
          <input
            id="startTime"
            name="startTime"
            type="time"
            required
            value={form.startTime}
            onChange={(event) => setField("startTime", event.target.value)}
          />
        </Field>

        <Field label="To date" error={errors.toDate}>
          <input
            id="toDate"
            name="toDate"
            type="date"
            min={toDateMin}
            required
            value={form.toDate}
            onChange={(event) => setField("toDate", event.target.value)}
          />
        </Field>

        <Field label="End time" error={errors.endTime}>
          <input
            id="endTime"
            name="endTime"
            type="time"
            min={endTimeMin}
            required
            value={form.endTime}
            onChange={(event) => setField("endTime", event.target.value)}
          />
        </Field>

        <Field label="Booking type" error={errors.bookingType}>
          <select
            id="bookingType"
            name="bookingType"
            required
            value={form.bookingType}
            onChange={(event) => setField("bookingType", event.target.value)}
          >
            <option value="half_day">Half day</option>
            <option value="full_day">Full day</option>
          </select>
        </Field>

        <Field label="Half-day slot" error={errors.timeSlot} id="timeSlotWrap" hidden={isFullDay}>
          <select
            id="timeSlot"
            name="timeSlot"
            required={!isFullDay}
            value={isFullDay ? "full_day" : form.timeSlot}
            onChange={(event) => setField("timeSlot", event.target.value)}
          >
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
          </select>
        </Field>

        <Field label="Number of people" error={errors.passengerCount}>
          <input
            name="passengerCount"
            type="number"
            min="1"
            step="1"
            placeholder="24"
            required
            value={form.passengerCount}
            onChange={(event) => setField("passengerCount", event.target.value)}
          />
        </Field>

        <Field label="Extra notes" error="" className="full-width">
          <textarea
            name="notes"
            rows="3"
            placeholder="Add any timing or coordination notes."
            value={form.notes}
            onChange={(event) => setField("notes", event.target.value)}
          />
        </Field>

        <div className="full-width request-section">
          <h2>Declaration</h2>
          <p>You must accept the transport terms to submit the request.</p>
        </div>

        <label className="full-width">
          <span className="sr-only">Terms agreement</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontWeight: 500 }}>
            <input
              id="termsAccepted"
              name="termsAccepted"
              type="checkbox"
              style={{ width: "auto", minHeight: "auto" }}
              checked={form.termsAccepted}
              onChange={(event) => setField("termsAccepted", event.target.checked)}
            />
            I have read and agree to the vehicle hiring terms and conditions.
          </span>
          <small data-error-for="termsAccepted">{errors.termsAccepted || ""}</small>
        </label>

        <div className="full-width form-actions">
          <button id="submitButton" className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit request"}
          </button>
          <a href="/" className="ghost-button">
            Cancel
          </a>
        </div>

        <div id="formMessage" className="full-width form-message" aria-live="polite" data-tone={message.tone || undefined}>
          {message.text}
        </div>
      </form>
    </section>
  );
}

function Field({ children, className = "", error, hidden = false, id, label }) {
  return (
    <label className={className} id={id} hidden={hidden}>
      <span>{label}</span>
      {children}
      <small>{error || ""}</small>
    </label>
  );
}

function validatePayload(payload) {
  const errors = {};
  const isMember = payload.memberStatus === "yes";
  const isFullDay = payload.bookingType === "full_day";
  const endLocationIsOther = payload.endLocationMode === "other";

  if (isMember && payload.membershipNumber.length < 3) {
    errors.membershipNumber = "Membership number is required for members.";
  }

  if (payload.requesterName.length < 2) {
    errors.requesterName = "Enter your full name.";
  }

  if (payload.organizationName.length < 2) {
    errors.organizationName = "Enter organisation or ministry name.";
  }

  if (!payload.requesterEmail) {
    errors.requesterEmail = "Email is required.";
  } else if (!EMAIL_PATTERN.test(payload.requesterEmail)) {
    errors.requesterEmail = "Enter a valid email address.";
  }

  if (!GHANA_PHONE_PATTERN.test(payload.phone)) {
    errors.phone = "Use a 10-digit Ghana phone number starting with 0.";
  }

  if (payload.eventName.length < 2) {
    errors.eventName = "Enter the event name.";
  }

  if (payload.purpose.length < 12) {
    errors.purpose = "Purpose should be at least 12 characters.";
  }

  if (!Number.isInteger(payload.passengerCount) || payload.passengerCount < 1) {
    errors.passengerCount = "Enter the number of people.";
  }

  if (!payload.endLocationMode) {
    errors.endLocationMode = "Choose the end location mode.";
  }

  if (endLocationIsOther && payload.endLocation.length < 2) {
    errors.endLocation = "Enter the end location.";
  }

  if (!payload.fromDate) {
    errors.fromDate = "Select a start date.";
  } else if (payload.fromDate < currentLocalDateString()) {
    errors.fromDate = "Start date cannot be in the past.";
  }

  if (!payload.toDate) {
    errors.toDate = "Select an end date.";
  } else if (payload.fromDate && payload.toDate < payload.fromDate) {
    errors.toDate = "End date cannot be earlier than start date.";
  }

  if (!payload.startTime) {
    errors.startTime = "Select a start time.";
  }

  if (!payload.endTime) {
    errors.endTime = "Select an end time.";
  } else if (
    payload.fromDate &&
    payload.toDate &&
    payload.startTime &&
    payload.endTime &&
    payload.fromDate === payload.toDate &&
    payload.endTime <= payload.startTime
  ) {
    errors.endTime = "End time must be later than start time for same-day trips.";
  }

  if (!payload.bookingType) {
    errors.bookingType = "Choose a booking type.";
  }

  if (!isFullDay && !payload.timeSlot) {
    errors.timeSlot = "Choose a half-day slot.";
  }

  if (payload.pickupLocation.length < 2) {
    errors.pickupLocation = "Enter pickup location.";
  }

  if (payload.destination.length < 2) {
    errors.destination = "Enter destination.";
  }

  if (!payload.termsAccepted) {
    errors.termsAccepted = "You must accept the terms and conditions.";
  }

  return errors;
}

function normalizePayload(payload) {
  const pickupLocation = String(payload.pickupLocation || "").trim();
  const endLocationMode = String(payload.endLocationMode || "").trim();
  const endLocationRaw = String(payload.endLocation || "").trim();

  return {
    ...payload,
    bookingType: String(payload.bookingType || "").trim(),
    destination: String(payload.destination || "").trim(),
    endLocationMode,
    endLocation: endLocationMode === "same_as_setoff" ? pickupLocation : endLocationRaw,
    eventName: String(payload.eventName || "").trim(),
    startTime: String(payload.startTime || "").trim(),
    endTime: String(payload.endTime || "").trim(),
    memberStatus: String(payload.memberStatus || "").trim(),
    membershipNumber: String(payload.membershipNumber || "").trim(),
    organizationName: String(payload.organizationName || "").trim(),
    notes: String(payload.notes || "").trim(),
    phone: String(payload.phone || "").replace(/\D/g, "").slice(0, 10),
    passengerCount: Number.parseInt(String(payload.passengerCount || ""), 10),
    pickupLocation,
    purpose: String(payload.purpose || "").trim(),
    requesterEmail: String(payload.requesterEmail || "").trim(),
    requesterName: String(payload.requesterName || "").trim(),
    timeSlot: String(payload.timeSlot || "").trim(),
    fromDate: String(payload.fromDate || payload.travelDate || "").trim(),
    toDate: String(payload.toDate || payload.travelDate || "").trim(),
    termsAccepted: Boolean(payload.termsAccepted),
  };
}

function currentLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
