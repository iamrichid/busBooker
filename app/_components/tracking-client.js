"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const initialSteps = {
  approval: false,
  paid: false,
  release: false,
  submitted: true,
};

export default function TrackingClient({ initialCode = "" }) {
  const router = useRouter();
  const normalizedInitialCode = String(initialCode || "").trim().toUpperCase();
  const [code, setCode] = useState(normalizedInitialCode);
  const [message, setMessage] = useState({ text: "", tone: "" });
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    if (normalizedInitialCode) {
      void loadTracking(normalizedInitialCode);
    }
  }, [normalizedInitialCode]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedCode) {
      setBooking(null);
      setMessage({ text: "Enter your tracking code.", tone: "error" });
      return;
    }

    router.replace(`/track?code=${encodeURIComponent(trimmedCode)}`);
    await loadTracking(trimmedCode);
  };

  const loadTracking = async (trackingCode) => {
    setMessage({ text: "Checking request status...", tone: "neutral" });
    setBooking(null);

    try {
      const response = await fetch(`/api/tracking?code=${encodeURIComponent(trackingCode)}`);
      const result = await response.json();

      if (!response.ok) {
        setMessage({ text: result.error || "We could not find that request.", tone: "error" });
        return;
      }

      setBooking(result.booking);
      setMessage({ text: "", tone: "" });
    } catch (error) {
      setMessage({ text: error.message || "The server could not be reached.", tone: "error" });
    }
  };

  const view = booking ? toTrackingView(booking) : null;

  return (
    <section className="panel tracking-panel">
      <form id="trackingForm" className="tracking-form" onSubmit={handleSubmit}>
        <label>
          <span>Tracking code</span>
          <input
            id="trackingCodeInput"
            className="tracking-code-input"
            type="text"
            placeholder="BUS-1234ABCD"
            autoComplete="off"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </label>
        <button className="primary-button" type="submit">
          Check status
        </button>
      </form>

      <div id="trackingMessage" className="form-message" aria-live="polite" data-tone={message.tone || undefined}>
        {message.text}
      </div>

      <section id="trackingResult" className="tracking-result" hidden={!view}>
        {view ? (
          <>
            <div className="tracking-head">
              <div>
                <p className="eyebrow">Tracking code</p>
                <h2 id="trackingCodeTitle" className="tracking-code-display">
                  {view.trackingCode}
                </h2>
              </div>
              <span id="trackingStatusBadge" className="status-badge" data-status={view.status}>
                {view.statusLabel}
              </span>
            </div>

            <div className="tracking-summary">
              <div>
                <span>Event</span>
                <strong id="trackingEventName">{view.eventName}</strong>
              </div>
              <div>
                <span>Date</span>
                <strong id="trackingDateRange">{view.dateRange}</strong>
              </div>
              <div>
                <span>Payment</span>
                <strong id="trackingPayment">{view.paymentLabel}</strong>
              </div>
            </div>

            <ol className="tracking-steps" aria-label="Request progress">
              <li id="trackingStepSubmitted" data-complete="true">
                <span />
                <div>
                  <strong>Request submitted</strong>
                  <p id="trackingSubmittedAt">{view.submittedText}</p>
                </div>
              </li>
              <li id="trackingStepApproval" data-complete={String(view.steps.approval)}>
                <span />
                <div>
                  <strong>Approved to pay</strong>
                  <p id="trackingApprovalText">{view.approvalText}</p>
                </div>
              </li>
              <li id="trackingStepPaid" data-complete={String(view.steps.paid)}>
                <span />
                <div>
                  <strong>Payment confirmed</strong>
                  <p id="trackingPaymentText">{view.paymentText}</p>
                </div>
              </li>
              <li id="trackingStepRelease" data-complete={String(view.steps.release)}>
                <span />
                <div>
                  <strong>Bus released</strong>
                  <p id="trackingDecisionText">{view.decisionText}</p>
                </div>
              </li>
            </ol>

            <p id="trackingAdminNote" className="tracking-note" hidden={!view.adminNote}>
              {view.adminNote}
            </p>
          </>
        ) : null}
      </section>
    </section>
  );
}

function toTrackingView(booking) {
  const paymentConfirmed = booking.paymentStatus === "confirmed";
  const approvedToPay =
    booking.status === "awaiting_payment" || booking.status === "approved" || booking.status === "declined";
  const released = booking.status === "approved";

  return {
    adminNote: booking.adminNotes ? `Admin note: ${booking.adminNotes}` : "",
    approvalText:
      approvedToPay
        ? booking.status === "declined"
          ? "The request was declined by the transport desk."
          : "Transport admin has approved this request to proceed to payment."
        : "Waiting for transport admin to approve the request to pay.",
    dateRange: formatDateRange(booking.fromDate, booking.toDate),
    decisionText:
      booking.status === "approved"
        ? booking.assignedVehicleLabel
          ? `Released and assigned to ${booking.assignedVehicleLabel}.`
          : "Bus released by the transport desk."
        : booking.status === "declined"
          ? "Bus was not released because the request was declined."
          : paymentConfirmed
            ? "Payment is confirmed. Waiting for transport admin to release the bus."
            : "Bus release happens after payment is confirmed.",
    eventName: booking.eventName || "Bus request",
    paymentLabel: paymentConfirmed ? "Confirmed" : "Pending",
    paymentText: paymentConfirmed
      ? `Payment confirmed${booking.paymentConfirmedAt ? ` on ${formatDateTime(booking.paymentConfirmedAt)}` : ""}.`
      : approvedToPay && booking.status !== "declined"
        ? "Waiting for finance to confirm payment."
        : "Payment opens after admin approves the request to pay.",
    status: booking.status,
    statusLabel: getStatusLabel(booking.status),
    steps: {
      ...initialSteps,
      approval: approvedToPay,
      paid: paymentConfirmed,
      release: released,
    },
    submittedText: booking.submittedAt
      ? `Received on ${formatDateTime(booking.submittedAt)}.`
      : "Request received.",
    trackingCode: booking.trackingCode,
  };
}

function getStatusLabel(status) {
  if (status === "awaiting_payment") {
    return "Awaiting payment";
  }

  if (status === "approved") {
    return "Released";
  }

  return status || "pending";
}

function formatDateRange(fromDate, toDate) {
  if (!fromDate || !toDate) {
    return "Selected travel date";
  }

  if (fromDate === toDate) {
    return formatDate(fromDate);
  }

  return `${formatDate(fromDate)} to ${formatDate(toDate)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
