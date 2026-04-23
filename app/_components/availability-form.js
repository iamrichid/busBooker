"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BOOKING_LEAD_DAYS = 7;

export default function AvailabilityForm() {
  const router = useRouter();
  const today = useMemo(() => currentLocalDateString(), []);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [message, setMessage] = useState("No date range selected yet.");

  const effectiveToDateMin = fromDate || today;
  const hasSelection = Boolean(fromDate && toDate);
  const leadWindow = isWithinLeadWindow(fromDate);

  const applyDateRange = () => {
    if (!fromDate || !toDate) {
      setMessage("Choose both from and to dates.");
      return;
    }

    if (toDate < fromDate) {
      setMessage("End date cannot be earlier than start date.");
      return;
    }

    setMessage(`Selected: ${formatDate(fromDate)} to ${formatDate(toDate)}`);
  };

  const handleContinue = () => {
    if (!hasSelection) {
      return;
    }

    router.push(`/request?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`);
  };

  return (
    <section className="panel availability-form-panel">
      <div className="availability-form-copy">
        <h2>Check dates</h2>
        <p>Enter your preferred date range before filling the request form.</p>
      </div>

      <div className="availability-picker">
        <label>
          <span>From date</span>
          <input
            id="availabilityFromDate"
            type="date"
            min={today}
            value={fromDate}
            onChange={(event) => {
              const nextFromDate = event.target.value;
              setFromDate(nextFromDate);
              setMessage("No date range selected yet.");

              if (toDate && nextFromDate && toDate < nextFromDate) {
                setToDate(nextFromDate);
              }
            }}
          />
        </label>
        <label>
          <span>To date</span>
          <input
            id="availabilityToDate"
            type="date"
            min={effectiveToDateMin}
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setMessage("No date range selected yet.");
            }}
          />
        </label>
        <button id="applyDateRangeButton" className="ghost-button" type="button" onClick={applyDateRange}>
          Apply date range
        </button>
      </div>

      <p id="selectedDateRangeText" className="availability-selection">
        {message}
      </p>
      <p id="leadTimeWarning" className="lead-time-warning" hidden={!leadWindow}>
        This selection is within 7 days, so approval may take longer or the bus may be unavailable.
      </p>
      <button
        id="continueToRequestButton"
        className="primary-button"
        type="button"
        disabled={!hasSelection}
        onClick={handleContinue}
      >
        Continue to Request Form
      </button>
    </section>
  );
}

function isWithinLeadWindow(dateString) {
  return Boolean(dateString && dateString < preferredBookingDateString());
}

function preferredBookingDateString() {
  return addDays(currentLocalDateString(), BOOKING_LEAD_DAYS);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentLocalDateString() {
  return toDateInputValue(new Date());
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}
