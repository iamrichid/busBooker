const calendarNode = document.querySelector("#availabilityCalendar");
const continueButton = document.querySelector("#continueToRequestButton");
const selectedDateRangeText = document.querySelector("#selectedDateRangeText");
const fromDateInput = document.querySelector("#availabilityFromDate");
const toDateInput = document.querySelector("#availabilityToDate");
const applyDateRangeButton = document.querySelector("#applyDateRangeButton");

const state = {
  calendar: null,
  fromDate: "",
  toDate: "",
};

if (calendarNode) {
  initializeCalendar();
}

configureDatePickers();

async function initializeCalendar() {
  const availability = await loadAvailability();
  const events = mapBookingsToEvents(availability.bookings || []);

  const calendar = new FullCalendar.Calendar(calendarNode, {
    headerToolbar: {
      center: "title",
      left: "prev,next today",
      right: "dayGridMonth,timeGridWeek",
    },
    height: "auto",
    initialView: "dayGridMonth",
    validRange: {
      start: currentLocalDateString(),
    },
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    events,
    select: (info) => {
      const fromDate = info.startStr.slice(0, 10);
      const toDate = toInclusiveDate(info.endStr);
      updateSelectedRange(fromDate, toDate);
    },
    dateClick: (info) => {
      updateSelectedRange(info.dateStr, info.dateStr);
    },
  });

  calendar.render();
  state.calendar = calendar;
}

continueButton?.addEventListener("click", () => {
  if (!state.fromDate || !state.toDate) {
    return;
  }

  const target = `/request?fromDate=${encodeURIComponent(state.fromDate)}&toDate=${encodeURIComponent(state.toDate)}`;
  window.location.href = target;
});

applyDateRangeButton?.addEventListener("click", () => {
  const fromDate = String(fromDateInput?.value || "");
  const toDate = String(toDateInput?.value || "");

  if (!fromDate || !toDate) {
    selectedDateRangeText.textContent = "Choose both from and to dates.";
    return;
  }

  if (toDate < fromDate) {
    selectedDateRangeText.textContent = "End date cannot be earlier than start date.";
    return;
  }

  updateSelectedRange(fromDate, toDate);

  if (state.calendar) {
    state.calendar.select({
      start: fromDate,
      end: addDays(toDate, 1),
    });
  }
});

async function loadAvailability() {
  try {
    const response = await fetch("/api/availability");
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not load availability.");
    }

    return result;
  } catch (error) {
    selectedDateRangeText.textContent = error.message || "Could not load availability.";
    return { bookings: [] };
  }
}

function mapBookingsToEvents(bookings) {
  return bookings.map((booking) => {
    const fromDate = booking.fromDate || booking.travelDate;
    const toDate = booking.toDate || booking.travelDate;
    const titlePrefix = booking.bookingType === "full_day" ? "Booked • Full day" : `Booked • ${booking.timeSlot}`;

    return {
      allDay: true,
      color: booking.bookingType === "full_day" ? "#d14343" : "#c88a16",
      display: "block",
      end: addDays(toDate, 1),
      start: fromDate,
      title: `${titlePrefix}${booking.eventName ? ` • ${booking.eventName}` : ""}`,
    };
  });
}

function updateSelectedRange(fromDate, toDate) {
  state.fromDate = fromDate;
  state.toDate = toDate;

  if (!fromDate || !toDate) {
    selectedDateRangeText.textContent = "No date range selected yet.";
    continueButton.disabled = true;
    return;
  }

  selectedDateRangeText.textContent = `Selected: ${formatDate(fromDate)} to ${formatDate(toDate)}`;
  continueButton.disabled = false;
  syncPickers(fromDate, toDate);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function toInclusiveDate(fullCalendarEnd) {
  const date = new Date(`${fullCalendarEnd.slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return toDateInputValue(date);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function configureDatePickers() {
  const today = currentLocalDateString();

  if (fromDateInput) {
    fromDateInput.min = today;
    fromDateInput.addEventListener("change", () => {
      if (toDateInput) {
        toDateInput.min = fromDateInput.value || today;

        if (toDateInput.value && fromDateInput.value && toDateInput.value < fromDateInput.value) {
          toDateInput.value = fromDateInput.value;
        }
      }
    });
  }

  if (toDateInput) {
    toDateInput.min = today;
  }
}

function syncPickers(fromDate, toDate) {
  if (fromDateInput) {
    fromDateInput.value = fromDate;
  }

  if (toDateInput) {
    toDateInput.min = fromDate;
    toDateInput.value = toDate;
  }
}

function currentLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
