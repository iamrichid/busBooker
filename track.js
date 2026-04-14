const trackingForm = document.querySelector("#trackingForm");
const trackingCodeInput = document.querySelector("#trackingCodeInput");
const trackingMessage = document.querySelector("#trackingMessage");
const trackingResult = document.querySelector("#trackingResult");
const trackingCodeTitle = document.querySelector("#trackingCodeTitle");
const trackingStatusBadge = document.querySelector("#trackingStatusBadge");
const trackingEventName = document.querySelector("#trackingEventName");
const trackingDateRange = document.querySelector("#trackingDateRange");
const trackingPayment = document.querySelector("#trackingPayment");
const trackingApprovalText = document.querySelector("#trackingApprovalText");
const trackingSubmittedAt = document.querySelector("#trackingSubmittedAt");
const trackingPaymentText = document.querySelector("#trackingPaymentText");
const trackingDecisionText = document.querySelector("#trackingDecisionText");
const trackingAdminNote = document.querySelector("#trackingAdminNote");

const stepNodes = {
  approval: document.querySelector("#trackingStepApproval"),
  paid: document.querySelector("#trackingStepPaid"),
  release: document.querySelector("#trackingStepRelease"),
  submitted: document.querySelector("#trackingStepSubmitted"),
};

const params = new URLSearchParams(window.location.search);
const initialCode = String(params.get("code") || "").trim();

if (initialCode) {
  trackingCodeInput.value = initialCode.toUpperCase();
  loadTracking(initialCode);
}

trackingForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = trackingCodeInput.value.trim();

  if (!code) {
    setMessage("Enter your tracking code.", "error");
    trackingResult.hidden = true;
    return;
  }

  window.history.replaceState(null, "", `/track?code=${encodeURIComponent(code.toUpperCase())}`);
  loadTracking(code);
});

async function loadTracking(code) {
  setMessage("Checking request status...", "neutral");
  trackingResult.hidden = true;

  try {
    const response = await fetch(`/api/tracking?code=${encodeURIComponent(code)}`);
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "We could not find that request.", "error");
      return;
    }

    renderTracking(result.booking);
    clearMessage();
  } catch (error) {
    setMessage(error.message || "The server could not be reached.", "error");
  }
}

function renderTracking(booking) {
  trackingResult.hidden = false;
  trackingCodeTitle.textContent = booking.trackingCode;
  trackingStatusBadge.textContent = getStatusLabel(booking.status);
  trackingStatusBadge.dataset.status = booking.status;
  trackingEventName.textContent = booking.eventName || "Bus request";
  trackingDateRange.textContent = formatDateRange(booking.fromDate, booking.toDate);
  trackingPayment.textContent = booking.paymentStatus === "confirmed" ? "Confirmed" : "Pending";
  trackingSubmittedAt.textContent = booking.submittedAt
    ? `Received on ${formatDateTime(booking.submittedAt)}.`
    : "Request received.";

  const paymentConfirmed = booking.paymentStatus === "confirmed";
  const approvedToPay =
    booking.status === "awaiting_payment" || booking.status === "approved" || booking.status === "declined";
  const released = booking.status === "approved";

  trackingApprovalText.textContent = approvedToPay
    ? booking.status === "declined"
      ? "The request was declined by the transport desk."
      : "Transport admin has approved this request to proceed to payment."
    : "Waiting for transport admin to approve the request to pay.";

  trackingPaymentText.textContent = paymentConfirmed
    ? `Payment confirmed${booking.paymentConfirmedAt ? ` on ${formatDateTime(booking.paymentConfirmedAt)}` : ""}.`
    : approvedToPay && booking.status !== "declined"
      ? "Waiting for finance to confirm payment."
      : "Payment opens after admin approves the request to pay.";

  if (booking.status === "approved") {
    trackingDecisionText.textContent = booking.assignedVehicleLabel
      ? `Released and assigned to ${booking.assignedVehicleLabel}.`
      : "Bus released by the transport desk.";
  } else if (booking.status === "declined") {
    trackingDecisionText.textContent = "Bus was not released because the request was declined.";
  } else {
    trackingDecisionText.textContent = paymentConfirmed
      ? "Payment is confirmed. Waiting for transport admin to release the bus."
      : "Bus release happens after payment is confirmed.";
  }

  setStepState(stepNodes.submitted, true);
  setStepState(stepNodes.approval, approvedToPay);
  setStepState(stepNodes.paid, paymentConfirmed);
  setStepState(stepNodes.release, released);

  trackingAdminNote.hidden = !booking.adminNotes;
  trackingAdminNote.textContent = booking.adminNotes ? `Admin note: ${booking.adminNotes}` : "";
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

function setStepState(node, isComplete) {
  node.dataset.complete = String(isComplete);
}

function setMessage(message, tone) {
  trackingMessage.textContent = message;

  if (tone === "neutral") {
    trackingMessage.removeAttribute("data-tone");
    return;
  }

  trackingMessage.dataset.tone = tone;
}

function clearMessage() {
  trackingMessage.textContent = "";
  trackingMessage.removeAttribute("data-tone");
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
