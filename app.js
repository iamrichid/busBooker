const dialog = document.querySelector("#bookingDialog");
const form = document.querySelector("#booking-form");
const bookingType = document.querySelector("#bookingType");
const memberStatus = document.querySelector("#memberStatus");
const membershipNumberWrap = document.querySelector("#membershipNumberWrap");
const phoneInput = document.querySelector("#phone");
const timeSlot = document.querySelector("#timeSlot");
const timeSlotWrap = document.querySelector("#timeSlotWrap");
const fromDateInput = document.querySelector("#fromDate");
const toDateInput = document.querySelector("#toDate");
const submitButton = document.querySelector("#submitButton");
const formMessage = document.querySelector("#formMessage");
const pageNotice = document.querySelector("#pageNotice");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GHANA_PHONE_PATTERN = /^0\d{9}$/;
const LIVE_VALIDATE_FIELDS = [
  "memberStatus",
  "membershipNumber",
  "requesterName",
  "ministryName",
  "requesterEmail",
  "phone",
  "eventName",
  "purpose",
  "fromDate",
  "toDate",
  "bookingType",
  "timeSlot",
  "pickupLocation",
  "destination",
];

document.querySelectorAll("[data-open-booking]").forEach((button) => {
  button.addEventListener("click", openBookingExperience);
});

document.querySelector("#closeBookingButton")?.addEventListener("click", closeBookingDialog);
document.querySelector("#cancelBookingButton")?.addEventListener("click", closeBookingDialog);

setDateBounds();
clearMessage();
clearPageNotice();
syncBookingType();
syncMembershipState();

bookingType?.addEventListener("change", syncBookingType);
memberStatus?.addEventListener("change", syncMembershipState);
phoneInput?.addEventListener("input", sanitizePhoneInput);
fromDateInput?.addEventListener("change", syncToDateWithFromDate);
form?.addEventListener("submit", handleSubmit);
bindLiveValidation();
initHeroSlideshow();

if (dialog) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeBookingDialog();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isDialogOpen()) {
    closeBookingDialog();
  }
});

async function handleSubmit(event) {
  event.preventDefault();
  clearErrors();

  const payload = normalizePayload(Object.fromEntries(new FormData(form).entries()));
  const clientErrors = validatePayload(payload);

  if (Object.keys(clientErrors).length > 0) {
    showFieldErrors(clientErrors);
    setMessage("Please correct the highlighted fields.", "error");
    focusFirstInvalidField(clientErrors);
    return;
  }

  setMessage("Submitting your request...", "neutral");
  if (submitButton) {
    submitButton.disabled = true;
  }

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
    syncMembershipState();
    setDateBounds();
    clearErrors();

    const notificationNotes = (result.notifications?.results || [])
      .map((entry) => `${entry.channel}: ${entry.status}`)
      .join(" | ");

    const successMessage = `${result.message}${notificationNotes ? ` Notification status: ${notificationNotes}.` : ""}`;

    if (dialog) {
      clearMessage();
      closeBookingDialog();
      setPageNotice(successMessage, "success");
    } else {
      setMessage(successMessage, "success");
    }
  } catch (error) {
    setMessage(error.message || "The server could not be reached.", "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

function syncBookingType() {
  if (!bookingType || !timeSlotWrap || !timeSlot) {
    return;
  }

  const isFullDay = bookingType.value === "full_day";
  timeSlotWrap.hidden = isFullDay;
  timeSlot.required = !isFullDay;
  timeSlot.value = isFullDay ? "full_day" : "morning";
}

function setDateBounds() {
  const today = currentLocalDateString();

  if (fromDateInput) {
    fromDateInput.min = today;
  }

  if (toDateInput) {
    toDateInput.min = fromDateInput?.value || today;
  }
}

function syncToDateWithFromDate() {
  if (!fromDateInput || !toDateInput) {
    return;
  }

  toDateInput.min = fromDateInput.value || currentLocalDateString();

  if (toDateInput.value && fromDateInput.value && toDateInput.value < fromDateInput.value) {
    toDateInput.value = fromDateInput.value;
  }

  clearErrorsForFields(["fromDate", "toDate"]);
}

function syncMembershipState() {
  if (!memberStatus || !membershipNumberWrap || !submitButton) {
    return;
  }

  const isMember = memberStatus.value === "yes";
  const membershipInput = membershipNumberWrap.querySelector("input");

  membershipNumberWrap.hidden = !isMember;
  membershipInput.required = isMember;

  if (!isMember) {
    membershipInput.value = "";
    clearErrorsForFields(["membershipNumber"]);
  } else if (formMessage?.dataset.tone === "error") {
    clearMessage();
  }

  submitButton.disabled = false;
}

function sanitizePhoneInput() {
  if (!phoneInput) {
    return;
  }

  phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 10);
  clearErrorsForFields(["phone"]);
}

function openBookingExperience() {
  if (dialog) {
    openBookingDialog();
    return;
  }

  window.location.href = "/request";
}

function openBookingDialog() {
  if (!dialog) {
    return;
  }

  clearPageNotice();

  if (dialog.showModal) {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }

  document.body.classList.add("dialog-open");
}

function closeBookingDialog() {
  if (!dialog) {
    return;
  }

  if (dialog?.close && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }

  document.body.classList.remove("dialog-open");
}

function isDialogOpen() {
  return Boolean(dialog?.open || dialog?.hasAttribute("open"));
}

function showFieldErrors(errors) {
  for (const [field, message] of Object.entries(errors)) {
    const errorNode = document.querySelector(`[data-error-for="${field}"]`);
    const inputNode = getFieldInput(field);

    if (errorNode) {
      errorNode.textContent = message;
    }

    if (inputNode) {
      inputNode.setAttribute("aria-invalid", "true");
    }
  }
}

function clearErrors() {
  document.querySelectorAll("[data-error-for]").forEach((node) => {
    node.textContent = "";
  });

  form?.querySelectorAll("[aria-invalid='true']").forEach((node) => {
    node.removeAttribute("aria-invalid");
  });
}

function clearErrorsForFields(fields) {
  fields.forEach((field) => {
    const errorNode = document.querySelector(`[data-error-for="${field}"]`);
    const inputNode = getFieldInput(field);

    if (errorNode) {
      errorNode.textContent = "";
    }

    if (inputNode) {
      inputNode.removeAttribute("aria-invalid");
    }
  });
}

function clearMessage() {
  if (!formMessage) {
    return;
  }

  formMessage.textContent = "";
  formMessage.removeAttribute("data-tone");
}

function setMessage(message, tone) {
  if (!formMessage) {
    return;
  }

  formMessage.textContent = message;

  if (tone === "neutral") {
    formMessage.removeAttribute("data-tone");
    return;
  }

  formMessage.dataset.tone = tone;
}

function clearPageNotice() {
  if (!pageNotice) {
    return;
  }

  pageNotice.textContent = "";
  pageNotice.hidden = true;
  pageNotice.removeAttribute("data-tone");
}

function setPageNotice(message, tone) {
  if (!pageNotice) {
    return;
  }

  pageNotice.hidden = false;
  pageNotice.textContent = message;

  if (tone === "neutral") {
    pageNotice.removeAttribute("data-tone");
    return;
  }

  pageNotice.dataset.tone = tone;
}

function currentLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function bindLiveValidation() {
  if (!form) {
    return;
  }

  LIVE_VALIDATE_FIELDS.forEach((field) => {
    const node = getFieldInput(field);

    if (!node) {
      return;
    }

    node.addEventListener("blur", () => validateSingleField(field));

    if (node.tagName === "SELECT") {
      node.addEventListener("change", () => validateSingleField(field));
      return;
    }

    node.addEventListener("input", () => clearErrorsForFields([field]));
  });
}

function validateSingleField(field) {
  if (!form) {
    return;
  }

  const payload = normalizePayload(Object.fromEntries(new FormData(form).entries()));
  const errors = validatePayload(payload);

  if (errors[field]) {
    showFieldErrors({ [field]: errors[field] });
    return;
  }

  clearErrorsForFields([field]);

  if (field === "requesterEmail" || field === "phone") {
    if (!errors.requesterEmail && !errors.phone) {
      clearErrorsForFields(["requesterEmail", "phone"]);
    }
  }
}

function validatePayload(payload) {
  const errors = {};
  const isMember = payload.memberStatus === "yes";
  const isFullDay = payload.bookingType === "full_day";

  if (isMember && payload.membershipNumber.length < 3) {
    errors.membershipNumber = "Membership number is required for members.";
  }

  if (payload.requesterName.length < 2) {
    errors.requesterName = "Enter your full name.";
  }

  if (payload.ministryName.length < 2) {
    errors.ministryName = "Enter ministry or department.";
  }

  if (!payload.requesterEmail && !payload.phone) {
    errors.requesterEmail = "Provide email or phone.";
    errors.phone = "Provide phone or email.";
  }

  if (payload.requesterEmail && !EMAIL_PATTERN.test(payload.requesterEmail)) {
    errors.requesterEmail = "Enter a valid email address.";
  }

  if (payload.phone && !GHANA_PHONE_PATTERN.test(payload.phone)) {
    errors.phone = "Use a 10-digit Ghana phone number starting with 0.";
  }

  if (payload.eventName.length < 2) {
    errors.eventName = "Enter the event name.";
  }

  if (payload.purpose.length < 12) {
    errors.purpose = "Purpose should be at least 12 characters.";
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

  return errors;
}

function normalizePayload(payload) {
  return {
    ...payload,
    bookingType: String(payload.bookingType || "").trim(),
    destination: String(payload.destination || "").trim(),
    eventName: String(payload.eventName || "").trim(),
    memberStatus: String(payload.memberStatus || "").trim(),
    membershipNumber: String(payload.membershipNumber || "").trim(),
    ministryName: String(payload.ministryName || "").trim(),
    notes: String(payload.notes || "").trim(),
    phone: String(payload.phone || "").replace(/\D/g, "").slice(0, 10),
    pickupLocation: String(payload.pickupLocation || "").trim(),
    purpose: String(payload.purpose || "").trim(),
    requesterEmail: String(payload.requesterEmail || "").trim(),
    requesterName: String(payload.requesterName || "").trim(),
    timeSlot: String(payload.timeSlot || "").trim(),
    fromDate: String(payload.fromDate || payload.travelDate || "").trim(),
    toDate: String(payload.toDate || payload.travelDate || "").trim(),
  };
}

function focusFirstInvalidField(errors) {
  const order = LIVE_VALIDATE_FIELDS;
  const firstField = order.find((field) => errors[field]);
  const node = getFieldInput(firstField);

  if (node) {
    node.focus();
  }
}

function getFieldInput(field) {
  if (!field || !form) {
    return null;
  }

  return form.querySelector(`[name="${field}"]`);
}

function initHeroSlideshow() {
  const image = document.querySelector("#heroBusImage");

  if (!image) {
    return;
  }

  let slides = [];

  try {
    slides = JSON.parse(image.dataset.slides || "[]");
  } catch {
    slides = [];
  }

  if (!Array.isArray(slides) || slides.length < 2) {
    return;
  }

  let index = 0;

  setInterval(() => {
    index = (index + 1) % slides.length;
    image.style.opacity = "0.28";

    setTimeout(() => {
      image.src = slides[index];
      image.style.opacity = "1";
    }, 200);
  }, 4200);
}
