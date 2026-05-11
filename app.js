const dialog = document.querySelector("#bookingDialog");
const form = document.querySelector("#booking-form");
const memberStatus = document.querySelector("#memberStatus");
const membershipNumberWrap = document.querySelector("#membershipNumberWrap");
const phoneInput = document.querySelector("#phone");
const endLocationMode = document.querySelector("#endLocationMode");
const endLocationWrap = document.querySelector("#endLocationWrap");
const fromDateInput = document.querySelector("#fromDate");
const toDateInput = document.querySelector("#toDate");
const fromDateDisplay = document.querySelector("#fromDateDisplay");
const toDateDisplay = document.querySelector("#toDateDisplay");
const startTimeInput = document.querySelector("#startTime");
const endTimeInput = document.querySelector("#endTime");
const submitButton = document.querySelector("#submitButton");
const formMessage = document.querySelector("#formMessage");
const pageNotice = document.querySelector("#pageNotice");
const termsDocumentMeta = document.querySelector("#termsDocumentMeta");
const termsModalMeta = document.querySelector("#termsModalMeta");
const termsDocumentContent = document.querySelector("#termsDocumentContent");
const termsAcceptedInput = document.querySelector("#termsAccepted");
const termsAgreementStatus = document.querySelector("#termsAgreementStatus");
const openTermsModalButton = document.querySelector("#openTermsModalButton");
const termsModal = document.querySelector("#termsModal");
const closeTermsModalButton = document.querySelector("#closeTermsModalButton");
const cancelTermsButton = document.querySelector("#cancelTermsButton");
const agreeTermsButton = document.querySelector("#agreeTermsButton");
const termsScrollHint = document.querySelector("#termsScrollHint");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GHANA_PHONE_PATTERN = /^0\d{9}$/;
/** Filled from GET /api/hiring-rates for client-side checks and the rate panel. */
let hiringRatesCache = null;
const LIVE_VALIDATE_FIELDS = [
  "memberStatus",
  "membershipNumber",
  "requesterName",
  "organizationName",
  "requesterEmail",
  "phone",
  "eventName",
  "purpose",
  "passengerCount",
  "endLocationMode",
  "endLocation",
  "fromDate",
  "startTime",
  "toDate",
  "endTime",
  "pickupLocation",
  "destinationRegionId",
  "destinationDetail",
  "termsAccepted",
];

document.querySelectorAll("[data-open-booking]").forEach((button) => {
  button.addEventListener("click", openBookingExperience);
});

document.querySelector("#closeBookingButton")?.addEventListener("click", closeBookingDialog);
document.querySelector("#cancelBookingButton")?.addEventListener("click", closeBookingDialog);

setDateBounds();
prefillBookingWindowFromQuery();
clearMessage();
clearPageNotice();
loadTermsDocument();
syncMembershipState();
syncEndLocationState();
bindCustomDateField({
  input: fromDateInput,
  display: fromDateDisplay,
  fieldName: "fromDate",
  emptyLabel: "Select date",
});
bindCustomDateField({
  input: toDateInput,
  display: toDateDisplay,
  fieldName: "toDate",
  emptyLabel: "Select date",
});

memberStatus?.addEventListener("change", syncMembershipState);
endLocationMode?.addEventListener("change", syncEndLocationState);
phoneInput?.addEventListener("input", sanitizePhoneInput);
fromDateInput?.addEventListener("change", syncDateAndTimeBounds);
toDateInput?.addEventListener("change", syncDateAndTimeBounds);
fromDateInput?.addEventListener("change", syncToDateWithFromDate);
openTermsModalButton?.addEventListener("click", openTermsModal);
closeTermsModalButton?.addEventListener("click", closeTermsModal);
cancelTermsButton?.addEventListener("click", closeTermsModal);
agreeTermsButton?.addEventListener("click", acceptTermsFromModal);
termsDocumentContent?.addEventListener("scroll", syncTermsModalProgress);
form?.addEventListener("submit", handleSubmit);
bindLiveValidation();
initHeroCarousel();
void initHiringRates();

if (dialog) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeBookingDialog();
    }
  });
}

if (termsModal) {
  termsModal.addEventListener("click", (event) => {
    if (event.target === termsModal) {
      closeTermsModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && termsModal?.open) {
    closeTermsModal();
    return;
  }

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
    syncMembershipState();
    setDateBounds();
    clearErrors();
    resetHiringRatePanelAfterFormReset();

    const notificationNotes = (result.notifications?.results || [])
      .map((entry) => `${entry.channel}: ${entry.status}`)
      .join(" | ");

    const successMessage = `${result.message}${notificationNotes ? ` Notification status: ${notificationNotes}.` : ""}`;

    if (result.trackingUrl) {
      window.location.href = result.trackingUrl;
      return;
    }

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

function setDateBounds() {
  const today = currentLocalDateString();

  if (fromDateInput) {
    fromDateInput.min = today;
    syncCustomDateField(fromDateInput, fromDateDisplay, "Select date");
  }

  if (toDateInput) {
    toDateInput.min = fromDateInput?.value || today;
    syncCustomDateField(toDateInput, toDateDisplay, "Select date");
  }

}

function syncToDateWithFromDate() {
  if (!fromDateInput || !toDateInput) {
    return;
  }

  toDateInput.min = fromDateInput.value || currentLocalDateString();

  if (toDateInput.value && fromDateInput.value && toDateInput.value < fromDateInput.value) {
    toDateInput.value = fromDateInput.value;
    syncCustomDateField(toDateInput, toDateDisplay, "Select date");
  }

  clearErrorsForFields(["fromDate", "toDate", "startTime", "endTime"]);
  syncDateAndTimeBounds();
}

function syncDateAndTimeBounds() {
  if (!fromDateInput || !toDateInput || !startTimeInput || !endTimeInput) {
    return;
  }

  if (fromDateInput.value && toDateInput.value && fromDateInput.value === toDateInput.value) {
    endTimeInput.min = startTimeInput.value || "";
  } else {
    endTimeInput.min = "";
  }
}

function syncEndLocationState() {
  if (!endLocationMode || !endLocationWrap || !form) {
    return;
  }

  const isOther = endLocationMode.value === "other";
  const endLocationInput = endLocationWrap.querySelector("input");

  endLocationWrap.hidden = !isOther;
  endLocationInput.required = isOther;

  if (!isOther) {
    endLocationInput.value = "";
    clearErrorsForFields(["endLocation"]);
  }
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
    const inputNode = getFormField(field);
    const visibleNode = getVisibleField(field);

    if (errorNode) {
      errorNode.textContent = message;
    }

    if (inputNode) {
      inputNode.setAttribute("aria-invalid", "true");
    }

    if (visibleNode && visibleNode !== inputNode) {
      visibleNode.setAttribute("aria-invalid", "true");
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
    const inputNode = getFormField(field);
    const visibleNode = getVisibleField(field);

    if (errorNode) {
      errorNode.textContent = "";
    }

    if (inputNode) {
      inputNode.removeAttribute("aria-invalid");
    }

    if (visibleNode && visibleNode !== inputNode) {
      visibleNode.removeAttribute("aria-invalid");
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

async function loadTermsDocument() {
  if (!termsDocumentMeta || !termsDocumentContent || !termsModalMeta) {
    return;
  }

  termsDocumentMeta.textContent = "Loading current terms...";

  try {
    const response = await fetch("/api/terms");
    const result = await response.json();

    if (!response.ok) {
      renderTermsDocument({
        content: "The latest transport terms could not be loaded right now.",
      });
      return;
    }

    renderTermsDocument(result.terms || {});
  } catch {
    renderTermsDocument({
      content: "The latest transport terms could not be loaded right now.",
    });
  }
}

function renderTermsDocument(terms) {
  if (!termsDocumentMeta || !termsDocumentContent || !termsModalMeta) {
    return;
  }

  const safeTerms = terms && typeof terms === "object" ? terms : {};
  const metaText = safeTerms.updatedAt
    ? `Updated ${formatDateDisplayOnly(safeTerms.updatedAt)}`
    : "Current saved version";
  termsDocumentMeta.textContent = metaText;
  termsModalMeta.textContent = metaText;
  termsDocumentContent.textContent = String(safeTerms.content || "").trim() || "No terms are available yet.";
  syncTermsModalProgress();
}

function openTermsModal() {
  if (!termsModal) {
    return;
  }

  syncTermsModalProgress(true);

  if (termsModal.showModal) {
    termsModal.showModal();
  } else {
    termsModal.setAttribute("open", "");
  }
}

function closeTermsModal() {
  if (!termsModal) {
    return;
  }

  if (termsModal.close && termsModal.open) {
    termsModal.close();
  } else {
    termsModal.removeAttribute("open");
  }
}

function syncTermsModalProgress(resetScroll = false) {
  if (!termsDocumentContent || !agreeTermsButton || !termsScrollHint) {
    return;
  }

  if (resetScroll) {
    termsDocumentContent.scrollTop = 0;
  }

  const maxScroll = termsDocumentContent.scrollHeight - termsDocumentContent.clientHeight;
  const isAtEnd = maxScroll <= 12 || termsDocumentContent.scrollTop >= maxScroll - 12;

  agreeTermsButton.disabled = !isAtEnd;
  termsScrollHint.textContent = isAtEnd
    ? "You have reached the end. You can now agree."
    : "Scroll to the end to enable the agree button.";
}

function acceptTermsFromModal() {
  if (!termsAcceptedInput || !termsAgreementStatus) {
    return;
  }

  termsAcceptedInput.checked = true;
  termsAgreementStatus.textContent = "Agreed. You can now submit the request.";
  clearErrorsForFields(["termsAccepted"]);
  closeTermsModal();
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
    const inputNode = getFormField(field);
    const visibleNode = getVisibleField(field);
    const node = visibleNode || inputNode;

    if (!inputNode) {
      return;
    }

    if (node) {
      node.addEventListener("blur", () => validateSingleField(field));
    }

    if (inputNode.tagName === "SELECT") {
      inputNode.addEventListener("change", () => validateSingleField(field));
      return;
    }

    if (inputNode.type === "checkbox") {
      inputNode.addEventListener("change", () => validateSingleField(field));
      return;
    }

    if (inputNode.type === "date") {
      inputNode.addEventListener("change", () => validateSingleField(field));
      return;
    }

    node?.addEventListener("input", () => clearErrorsForFields([field]));
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
  }

  if (!EMAIL_PATTERN.test(payload.requesterEmail)) {
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

  if (payload.pickupLocation.length < 2) {
    errors.pickupLocation = "Enter pickup location.";
  }

  if (!payload.destinationRegionId) {
    errors.destinationRegionId = "Select a destination region.";
  } else if (
    hiringRatesCache &&
    !hiringRatesCache.routes.some((route) => route.id === payload.destinationRegionId)
  ) {
    errors.destinationRegionId = "Choose a valid destination region.";
  }

  if (payload.destinationDetail.length > 500) {
    errors.destinationDetail = "Venue details must be 500 characters or fewer.";
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
    destinationRegionId: String(payload.destinationRegionId || "").trim(),
    destinationDetail: String(payload.destinationDetail || "").trim(),
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
    fromDate: String(payload.fromDate || payload.travelDate || "").trim(),
    toDate: String(payload.toDate || payload.travelDate || "").trim(),
    termsAccepted: String(payload.termsAccepted || "").toLowerCase() === "on",
  };
}

function focusFirstInvalidField(errors) {
  const order = LIVE_VALIDATE_FIELDS;
  const firstField = order.find((field) => errors[field]);
  const node = getVisibleField(firstField) || getFormField(firstField);

  if (node) {
    node.focus();
  }
}

function getFormField(field) {
  if (!field || !form) {
    return null;
  }

  return form.querySelector(`[name="${field}"]`);
}

function getVisibleField(field) {
  if (field === "fromDate") {
    return fromDateDisplay;
  }

  if (field === "toDate") {
    return toDateDisplay;
  }

  return getFormField(field);
}

function resetHiringRatePanelAfterFormReset() {
  const select = document.querySelector("#destinationRegionId");
  const panel = document.querySelector("#hireRatePanel");
  if (select) {
    select.selectedIndex = 0;
  }

  if (panel) {
    panel.hidden = true;
    panel.innerHTML = "";
  }
}

function syncHireRatePanel() {
  const select = document.querySelector("#destinationRegionId");
  const panel = document.querySelector("#hireRatePanel");
  if (!select || !panel) {
    return;
  }

  const option = select.selectedOptions[0];
  if (!option || !option.value) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  const rateRaw = option.dataset.rateGhs;
  const kmRaw = option.dataset.km;
  const rate = rateRaw ? Number.parseInt(rateRaw, 10) : NaN;
  const amount = Number.isFinite(rate)
    ? `GH₵ ${rate.toLocaleString("en-GH")}`
    : "See transport desk";

  let html = `<p class="hire-rate-amount">Indicative hiring rate (one way from Accra): <strong>${amount}</strong></p>`;
  html += `<span class="hire-rate-note">Official rate sheet; finance or transport may confirm the final charge.</span>`;

  if (kmRaw) {
    const km = Number.parseInt(kmRaw, 10);
    if (Number.isFinite(km)) {
      html += `<p class="hire-rate-km">Approx. distance on sheet: ${km} km</p>`;
    }
  }

  panel.innerHTML = html;
  panel.hidden = false;
}

async function initHiringRates() {
  const select = document.querySelector("#destinationRegionId");
  if (!select) {
    return;
  }

  select.addEventListener("change", syncHireRatePanel);

  try {
    const response = await fetch("/api/hiring-rates");
    if (!response.ok) {
      throw new Error("Bad response");
    }

    const data = await response.json();
    hiringRatesCache = data;

    const routes = Array.isArray(data.routes) ? data.routes : [];
    const byGroup = new Map();
    for (const route of routes) {
      const group = route.group || "Destinations";
      if (!byGroup.has(group)) {
        byGroup.set(group, []);
      }

      byGroup.get(group).push(route);
    }

    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select destination region…";
    select.append(placeholder);

    for (const [groupName, groupRoutes] of byGroup) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = groupName;
      for (const route of groupRoutes) {
        const opt = document.createElement("option");
        opt.value = route.id;
        opt.dataset.rateGhs = String(route.rateGhs);
        opt.dataset.km = route.km === null || route.km === undefined ? "" : String(route.km);
        opt.textContent = route.label;
        optgroup.append(opt);
      }

      select.append(optgroup);
    }
  } catch {
    hiringRatesCache = null;
    select.replaceChildren();
    const fallback = document.createElement("option");
    fallback.value = "";
    fallback.textContent = "Could not load rates — refresh and try again";
    select.append(fallback);
  }
}

function initHeroCarousel() {
  const track = document.querySelector("#heroCarouselTrack");
  const prevButton = document.querySelector("#heroPrevButton");
  const nextButton = document.querySelector("#heroNextButton");

  if (!track) {
    return;
  }

  let slides = [];

  try {
    slides = JSON.parse(track.dataset.slides || "[]");
  } catch {
    slides = [];
  }

  if (!Array.isArray(slides) || slides.length === 0) {
    return;
  }

  let index = 0;
  let timer = null;

  const applySlide = () => {
    track.style.backgroundImage = `url("${slides[index]}")`;
  };

  const move = (direction) => {
    index = (index + direction + slides.length) % slides.length;
    applySlide();
    resetTimer();
  };

  const resetTimer = () => {
    if (timer) {
      clearInterval(timer);
    }

    timer = setInterval(() => {
      index = (index + 1) % slides.length;
      applySlide();
    }, 5200);
  };

  prevButton?.addEventListener("click", () => move(-1));
  nextButton?.addEventListener("click", () => move(1));

  applySlide();
  resetTimer();
}

function prefillBookingWindowFromQuery() {
  if (!fromDateInput || !toDateInput || !startTimeInput || !endTimeInput) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const fromDate = String(params.get("fromDate") || "").trim();
  const startTime = String(params.get("startTime") || "").trim();
  const toDate = String(params.get("toDate") || "").trim();
  const endTime = String(params.get("endTime") || "").trim();

  if (!fromDate && !toDate && !startTime && !endTime) {
    return;
  }

  if (fromDate) {
    fromDateInput.value = fromDate;
    syncCustomDateField(fromDateInput, fromDateDisplay, "Select date");
  }

  if (toDate) {
    toDateInput.value = toDate;
    syncCustomDateField(toDateInput, toDateDisplay, "Select date");
  }

  if (startTime) {
    startTimeInput.value = startTime;
  }

  if (endTime) {
    endTimeInput.value = endTime;
  }

  syncToDateWithFromDate();
  syncDateAndTimeBounds();
}

function formatDisplayDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTimeDisplay(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateDisplayOnly(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function bindCustomDateField({ input, display, fieldName, emptyLabel }) {
  if (!input || !display) {
    return;
  }

  const openPicker = () => {
    input.focus();

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.click();
  };

  display.addEventListener("click", openPicker);
  display.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      openPicker();
    }
  });
  input.addEventListener("change", () => {
    syncCustomDateField(input, display, emptyLabel);
    clearErrorsForFields([fieldName]);
  });
  syncCustomDateField(input, display, emptyLabel);
}

function syncCustomDateField(input, display, emptyLabel) {
  if (!input || !display) {
    return;
  }

  display.value = input.value ? formatDisplayDate(input.value) : emptyLabel;
}
