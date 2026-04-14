const continueButton = document.querySelector("#continueToRequestButton");
const selectedDateRangeText = document.querySelector("#selectedDateRangeText");
const leadTimeWarning = document.querySelector("#leadTimeWarning");
const fromDateInput = document.querySelector("#availabilityFromDate");
const toDateInput = document.querySelector("#availabilityToDate");
const applyDateRangeButton = document.querySelector("#applyDateRangeButton");

const BOOKING_LEAD_DAYS = 7;

const state = {
  fromDate: "",
  toDate: "",
};

configureDatePickers();

continueButton?.addEventListener("click", () => {
  if (!state.fromDate || !state.toDate) {
    return;
  }

  const target = `/request?fromDate=${encodeURIComponent(state.fromDate)}&toDate=${encodeURIComponent(state.toDate)}`;
  window.location.href = target;
});

applyDateRangeButton?.addEventListener("click", () => {
  applyDateRange();
});

function applyDateRange() {
  const fromDate = String(fromDateInput?.value || "");
  const toDate = String(toDateInput?.value || "");

  if (!fromDate || !toDate) {
    updateSelectedRange("", "");
    selectedDateRangeText.textContent = "Choose both from and to dates.";
    return;
  }

  if (toDate < fromDate) {
    updateSelectedRange("", "");
    selectedDateRangeText.textContent = "End date cannot be earlier than start date.";
    return;
  }

  updateSelectedRange(fromDate, toDate);
}

function updateSelectedRange(fromDate, toDate) {
  state.fromDate = fromDate;
  state.toDate = toDate;

  if (!fromDate || !toDate) {
    continueButton.disabled = true;
    updateLeadTimeWarning("");
    return;
  }

  selectedDateRangeText.textContent = `Selected: ${formatDate(fromDate)} to ${formatDate(toDate)}`;
  continueButton.disabled = false;
  updateLeadTimeWarning(fromDate);
}

function updateLeadTimeWarning(fromDate) {
  if (!leadTimeWarning) {
    return;
  }

  leadTimeWarning.hidden = !isWithinLeadWindow(fromDate);
}

function configureDatePickers() {
  const today = currentLocalDateString();

  if (fromDateInput) {
    fromDateInput.min = today;
    fromDateInput.addEventListener("change", () => {
      syncToDateLimit();

      if (toDateInput?.value) {
        applyDateRange();
      }
    });
  }

  if (toDateInput) {
    toDateInput.min = today;
    toDateInput.addEventListener("change", applyDateRange);
  }
}

function syncToDateLimit() {
  if (!toDateInput || !fromDateInput) {
    return;
  }

  toDateInput.min = fromDateInput.value || currentLocalDateString();

  if (toDateInput.value && fromDateInput.value && toDateInput.value < fromDateInput.value) {
    toDateInput.value = fromDateInput.value;
  }
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
