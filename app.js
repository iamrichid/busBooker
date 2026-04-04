const form = document.querySelector("#booking-form");
const bookingType = document.querySelector("#bookingType");
const timeSlot = document.querySelector("#timeSlot");
const timeSlotWrap = document.querySelector("#timeSlotWrap");
const travelDate = document.querySelector("#travelDate");
const submitButton = document.querySelector("#submitButton");
const formMessage = document.querySelector("#formMessage");

travelDate.min = new Date().toISOString().slice(0, 10);
clearMessage();
syncBookingType();

bookingType.addEventListener("change", syncBookingType);
form.addEventListener("submit", handleSubmit);

async function handleSubmit(event) {
  event.preventDefault();
  clearErrors();
  setMessage("Submitting your request...", "neutral");
  submitButton.disabled = true;

  const payload = Object.fromEntries(new FormData(form).entries());

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
      showFieldErrors(result.fields || {});
      setMessage(result.error || "We could not submit your request.", "error");
      return;
    }

    form.reset();
    syncBookingType();
    travelDate.min = new Date().toISOString().slice(0, 10);

    const notificationNotes = (result.notifications?.results || [])
      .map((entry) => `${entry.channel}: ${entry.status}`)
      .join(" | ");

    setMessage(
      `${result.message}${notificationNotes ? ` Notification status: ${notificationNotes}.` : ""}`,
      "success",
    );
  } catch (error) {
    setMessage(error.message || "The server could not be reached.", "error");
  } finally {
    submitButton.disabled = false;
  }
}

function syncBookingType() {
  const isFullDay = bookingType.value === "full_day";
  timeSlotWrap.hidden = isFullDay;
  timeSlot.required = !isFullDay;
  timeSlot.value = isFullDay ? "full_day" : "morning";
}

function showFieldErrors(errors) {
  for (const [field, message] of Object.entries(errors)) {
    const errorNode = document.querySelector(`[data-error-for="${field}"]`);

    if (errorNode) {
      errorNode.textContent = message;
    }
  }
}

function clearErrors() {
  document.querySelectorAll("[data-error-for]").forEach((node) => {
    node.textContent = "";
  });
}

function clearMessage() {
  formMessage.textContent = "";
  formMessage.removeAttribute("data-tone");
}

function setMessage(message, tone) {
  formMessage.textContent = message;

  if (tone === "neutral") {
    formMessage.removeAttribute("data-tone");
    return;
  }

  formMessage.dataset.tone = tone;
}
