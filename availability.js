const continueButton = document.querySelector("#continueToRequestButton");
const selectedDateRangeText = document.querySelector("#selectedDateRangeText");
const leadTimeWarning = document.querySelector("#leadTimeWarning");
const fromDateInput = document.querySelector("#availabilityFromDate");
const toDateInput = document.querySelector("#availabilityToDate");
const startTimeInput = document.querySelector("#availabilityStartTime");
const endTimeInput = document.querySelector("#availabilityEndTime");
const fromDateDisplay = document.querySelector("#availabilityFromDateDisplay");
const toDateDisplay = document.querySelector("#availabilityToDateDisplay");
const applyDateRangeButton = document.querySelector("#applyDateRangeButton");

const BOOKING_LEAD_DAYS = 7;

const state = {
  fromDate: "",
  startTime: "",
  toDate: "",
  endTime: "",
};

configureDatePickers();

continueButton?.addEventListener("click", () => {
  if (!state.fromDate || !state.toDate || !state.startTime || !state.endTime) {
    return;
  }

  const target =
    `/request?fromDate=${encodeURIComponent(state.fromDate)}` +
    `&startTime=${encodeURIComponent(state.startTime)}` +
    `&toDate=${encodeURIComponent(state.toDate)}` +
    `&endTime=${encodeURIComponent(state.endTime)}`;
  window.location.href = target;
});

applyDateRangeButton?.addEventListener("click", () => {
  applyDateRange();
});

function applyDateRange() {
  const fromDate = String(fromDateInput?.value || "");
  const toDate = String(toDateInput?.value || "");
  const startTime = String(startTimeInput?.value || "");
  const endTime = String(endTimeInput?.value || "");

  if (!fromDate || !toDate || !startTime || !endTime) {
    updateSelectedRange("", "", "", "");
    selectedDateRangeText.textContent = "Choose start and end dates with times.";
    return;
  }

  if (toDate < fromDate) {
    updateSelectedRange("", "", "", "");
    selectedDateRangeText.textContent = "End date cannot be earlier than start date.";
    return;
  }

  if (fromDate === toDate && endTime <= startTime) {
    updateSelectedRange("", "", "", "");
    selectedDateRangeText.textContent = "End time must be later than start time for same-day trips.";
    return;
  }

  updateSelectedRange(fromDate, startTime, toDate, endTime);
}

function updateSelectedRange(fromDate, startTime, toDate, endTime) {
  state.fromDate = fromDate;
  state.startTime = startTime;
  state.toDate = toDate;
  state.endTime = endTime;

  if (!fromDate || !toDate || !startTime || !endTime) {
    continueButton.disabled = true;
    updateLeadTimeWarning("");
    return;
  }

  selectedDateRangeText.textContent =
    `Selected: ${formatDate(fromDate)} ${formatTime(startTime)} to ` +
    `${formatDate(toDate)} ${formatTime(endTime)}`;
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

  bindCustomDateField({
    input: fromDateInput,
    display: fromDateDisplay,
    emptyLabel: "Select date",
  });
  bindCustomDateField({
    input: toDateInput,
    display: toDateDisplay,
    emptyLabel: "Select date",
  });

  if (fromDateInput) {
    fromDateInput.min = today;
    fromDateInput.addEventListener("change", () => {
      syncCustomDateField(fromDateInput, fromDateDisplay, "Select date");
      syncToDateLimit();
      syncEndTimeLimit();

      if (toDateInput?.value && startTimeInput?.value && endTimeInput?.value) {
        applyDateRange();
      }
    });
  }

  if (toDateInput) {
    toDateInput.min = today;
    toDateInput.addEventListener("change", () => {
      syncCustomDateField(toDateInput, toDateDisplay, "Select date");
      syncEndTimeLimit();
      applyDateRange();
    });
  }

  startTimeInput?.addEventListener("change", () => {
    syncEndTimeLimit();
    applyDateRange();
  });

  endTimeInput?.addEventListener("change", applyDateRange);

  syncCustomDateField(fromDateInput, fromDateDisplay, "Select date");
  syncCustomDateField(toDateInput, toDateDisplay, "Select date");
}

function syncToDateLimit() {
  if (!toDateInput || !fromDateInput) {
    return;
  }

  toDateInput.min = fromDateInput.value || currentLocalDateString();

  if (toDateInput.value && fromDateInput.value && toDateInput.value < fromDateInput.value) {
    toDateInput.value = fromDateInput.value;
    syncCustomDateField(toDateInput, toDateDisplay, "Select date");
  }
}

function syncEndTimeLimit() {
  if (!fromDateInput || !toDateInput || !startTimeInput || !endTimeInput) {
    return;
  }

  if (fromDateInput.value && toDateInput.value && fromDateInput.value === toDateInput.value) {
    endTimeInput.min = startTimeInput.value || "";
  } else {
    endTimeInput.min = "";
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
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value) {
  const [hour = "00", minute = "00"] = String(value).split(":");
  const date = new Date(`2000-01-01T${hour}:${minute}:00`);

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function bindCustomDateField({ input, display, emptyLabel }) {
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
  syncCustomDateField(input, display, emptyLabel);
}

function syncCustomDateField(input, display, emptyLabel) {
  if (!input || !display) {
    return;
  }

  display.value = input.value ? formatDate(input.value) : emptyLabel;
}
