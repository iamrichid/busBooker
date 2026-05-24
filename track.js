const trackingForm = document.querySelector("#trackingForm");
const trackingCodeInput = document.querySelector("#trackingCodeInput");
const trackingMessage = document.querySelector("#trackingMessage");
const trackingResult = document.querySelector("#trackingResult");
const trackingCodeTitle = document.querySelector("#trackingCodeTitle");
const trackingStatusBadge = document.querySelector("#trackingStatusBadge");
const trackingEventName = document.querySelector("#trackingEventName");
const trackingDateRange = document.querySelector("#trackingDateRange");
const trackingPayment = document.querySelector("#trackingPayment");
const trackingPaymentForm = document.querySelector("#trackingPaymentForm");
const trackingPaymentHelp = document.querySelector("#trackingPaymentHelp");
const trackingPaymentPanel = document.querySelector("#trackingPaymentPanel");
const trackingPaymentReferenceError = document.querySelector("#trackingPaymentReferenceError");
const trackingPaymentReferenceInput = document.querySelector("#trackingPaymentReferenceInput");
const trackingPaymentSubmitButton = document.querySelector("#trackingPaymentSubmitButton");
const trackingApprovalText = document.querySelector("#trackingApprovalText");
const trackingSubmittedAt = document.querySelector("#trackingSubmittedAt");
const trackingPaymentText = document.querySelector("#trackingPaymentText");
const trackingDecisionText = document.querySelector("#trackingDecisionText");
const trackingAdminNote = document.querySelector("#trackingAdminNote");
let currentBooking = null;

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

trackingPaymentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentBooking?.trackingCode) {
    return;
  }

  trackingPaymentReferenceError.textContent = "";
  trackingPaymentSubmitButton.disabled = true;

  try {
    const response = await fetch(`/api/tracking?code=${encodeURIComponent(currentBooking.trackingCode)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentReference: trackingPaymentReferenceInput.value,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      if (result.fields?.paymentReference) {
        trackingPaymentReferenceError.textContent = result.fields.paymentReference;
      }
      setMessage(result.error || "Could not submit the transaction ID.", "error");
      return;
    }

    currentBooking = result.booking;
    renderTracking(result.booking);
    setMessage(result.message || "Transaction ID submitted.", "success");
  } catch (error) {
    setMessage(error.message || "The server could not be reached.", "error");
  } finally {
    trackingPaymentSubmitButton.disabled = false;
  }
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
  currentBooking = booking;
  trackingResult.hidden = false;
  trackingCodeTitle.textContent = booking.trackingCode;
  trackingStatusBadge.textContent = getStatusLabel(booking.status);
  trackingStatusBadge.dataset.status = booking.status;
  trackingEventName.textContent = booking.eventName || "Bus request";
  trackingDateRange.textContent = formatDateRange(booking.fromDate, booking.toDate);
  trackingPayment.textContent = getPaymentLabel(booking.paymentStatus);
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
    : booking.paymentStatus === "submitted"
      ? `Transaction ID submitted${booking.paymentSubmittedAt ? ` on ${formatDateTime(booking.paymentSubmittedAt)}` : ""}. Finance is reviewing it now.`
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

  const canSubmitPayment = booking.status === "awaiting_payment" && booking.paymentStatus !== "confirmed";
  trackingPaymentPanel.hidden = !canSubmitPayment;
  trackingPaymentReferenceInput.value = booking.paymentReference || "";
  trackingPaymentReferenceInput.disabled = !canSubmitPayment;
  trackingPaymentReferenceError.textContent = "";

  if (canSubmitPayment) {
    trackingPaymentHelp.textContent = `Pay to MoMo ${formatPhoneNumber(booking.paymentInstructionsNumber)} (${booking.paymentInstructionsName}) and paste the transaction ID here for finance verification.`;
    trackingPaymentSubmitButton.textContent = booking.paymentStatus === "submitted" ? "Update transaction ID" : "Submit transaction ID";
  }

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

function getPaymentLabel(status) {
  if (status === "confirmed") {
    return "Confirmed";
  }

  if (status === "submitted") {
    return "Submitted for review";
  }

  return "Pending";
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
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10 && digits.startsWith("0")) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return String(value || "");
}
