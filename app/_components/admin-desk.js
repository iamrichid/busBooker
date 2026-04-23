"use client";

import { useEffect, useMemo, useState } from "react";

const initialNotificationSettings = { adminPhones: [], financePhones: [] };
const initialAccessSettings = { accessCode: "", name: "" };
const initialDecisionErrors = {
  approvingAuthorityName: "",
  driverName: "",
  driverPhone: "",
  selectedVehicleId: "",
};

export default function AdminDesk() {
  const [adminName, setAdminName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState({ text: "Sign in to open the approval desk.", tone: "neutral" });
  const [authBusy, setAuthBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [fleet, setFleet] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notificationSettings, setNotificationSettings] = useState(initialNotificationSettings);
  const [accessSettings, setAccessSettings] = useState(initialAccessSettings);
  const [settingsErrors, setSettingsErrors] = useState({
    adminName: "",
    accessCode: "",
    adminPhones: "",
    financePhones: "",
  });
  const [savingAccessSettings, setSavingAccessSettings] = useState(false);
  const [savingNotificationSettings, setSavingNotificationSettings] = useState(false);
  const [modalBookingId, setModalBookingId] = useState(null);
  const [modalDraft, setModalDraft] = useState({
    adminNotes: "",
    approvingAuthorityName: "",
    driverName: "",
    driverPhone: "",
    selectedVehicleId: "",
  });
  const [decisionErrors, setDecisionErrors] = useState(initialDecisionErrors);
  const [decisionBusy, setDecisionBusy] = useState(false);

  useEffect(() => {
    const storedName = window.localStorage.getItem("bus-booker-admin-name") || "";
    setAdminName(storedName);
    void signIn({ restoreSession: true, storedName });
  }, []);

  const activeBooking = useMemo(
    () => bookings.find((booking) => booking.id === modalBookingId) || null,
    [bookings, modalBookingId],
  );

  const summary = useMemo(() => {
    const counts = {
      approved: 0,
      awaiting_payment: 0,
      declined: 0,
      pending: 0,
    };

    bookings.forEach((booking) => {
      counts[booking.status] = (counts[booking.status] || 0) + 1;
    });

    return counts;
  }, [bookings]);

  const signIn = async ({ restoreSession = false, storedName = "" } = {}) => {
    const nextAdminName = restoreSession ? storedName || adminName : adminName.trim();
    const nextAccessCode = accessCode.trim();

    if (!restoreSession) {
      if (!nextAccessCode) {
        setMessage({ text: "Please enter the admin access code.", tone: "error" });
        return;
      }

      if (!nextAdminName) {
        setMessage({ text: "Please enter the admin name.", tone: "error" });
        return;
      }
    }

    setAuthBusy(true);
    setMessage({ text: restoreSession ? "Restoring admin session..." : "Signing in...", tone: "neutral" });

    try {
      if (restoreSession) {
        const sessionResponse = await fetch("/api/admin/session");
        const sessionResult = await sessionResponse.json();

        if (!sessionResponse.ok) {
          clearStoredSession();
          setAuthenticated(false);
          setMessage({ text: "Sign in to open the approval desk.", tone: "neutral" });
          return;
        }

        setAdminName(sessionResult.adminName || nextAdminName || "");
      } else {
        const sessionResponse = await fetch("/api/admin/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessCode: nextAccessCode,
            adminName: nextAdminName,
          }),
        });
        const sessionResult = await sessionResponse.json();

        if (!sessionResponse.ok) {
          setMessage({ text: sessionResult.error || "Could not sign in to the approval desk.", tone: "error" });
          return;
        }

        setAdminName(sessionResult.adminName || nextAdminName);
      }

      const [bookingsResponse, settingsResponse, accessSettingsResponse] = await Promise.all([
        fetch("/api/admin/bookings"),
        fetch("/api/admin/notification-settings"),
        fetch("/api/admin/access-settings"),
      ]);
      const bookingsResult = await bookingsResponse.json();
      const notificationResult = await settingsResponse.json();
      const accessResult = await accessSettingsResponse.json();

      if (!bookingsResponse.ok) {
        setMessage({ text: bookingsResult.error || "Could not load admin bookings.", tone: "error" });
        return;
      }

      if (!settingsResponse.ok) {
        setMessage({ text: notificationResult.error || "Could not load notification contacts.", tone: "error" });
        return;
      }

      if (!accessSettingsResponse.ok) {
        setMessage({ text: accessResult.error || "Could not load admin sign-in settings.", tone: "error" });
        return;
      }

      setAuthenticated(true);
      setFleet(bookingsResult.fleet || []);
      setBookings(bookingsResult.bookings || []);
      setNotificationSettings(notificationResult.settings || initialNotificationSettings);
      setAccessSettings(accessResult.settings || initialAccessSettings);
      window.localStorage.setItem("bus-booker-admin-name", accessResult.adminName || bookingsResult.adminName || nextAdminName);
      setMessage({ text: `Signed in as ${accessResult.adminName || bookingsResult.adminName || nextAdminName}.`, tone: "success" });
    } catch (error) {
      setMessage({ text: error.message || "The server could not be reached.", tone: "error" });
    } finally {
      setAuthBusy(false);
    }
  };

  const refreshBookings = async ({ preserveModal = true } = {}) => {
    if (!authenticated) {
      return;
    }

    setMessage({ text: "Refreshing booking requests...", tone: "neutral" });

    try {
      const response = await fetch("/api/admin/bookings");
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout({ silent: true });
          setMessage({ text: "Your admin session has expired. Please sign in again.", tone: "error" });
          return;
        }

        setMessage({ text: result.error || "Could not load requests.", tone: "error" });
        return;
      }

      setFleet(result.fleet || []);
      setBookings(result.bookings || []);
      if (preserveModal && modalBookingId && !result.bookings?.some((booking) => booking.id === modalBookingId)) {
        setModalBookingId(null);
      }
      setMessage({ text: "Requests loaded successfully.", tone: "success" });
    } catch (error) {
      setMessage({ text: error.message || "The server could not be reached.", tone: "error" });
    }
  };

  const saveAccessSettings = async (event) => {
    event.preventDefault();
    if (!authenticated) return;

    setSavingAccessSettings(true);
    setSettingsErrors((current) => ({ ...current, adminName: "", accessCode: "" }));
    setMessage({ text: "Saving admin sign-in settings...", tone: "neutral" });

    try {
      const response = await fetch("/api/admin/access-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accessSettings),
      });
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout({ silent: true });
          setMessage({ text: "Your admin session has expired. Please sign in again.", tone: "error" });
          return;
        }

        setSettingsErrors((current) => ({
          ...current,
          adminName: result.fields?.adminName || "",
          accessCode: result.fields?.accessCode || "",
        }));
        setMessage({ text: result.error || "Could not save admin sign-in settings.", tone: "error" });
        return;
      }

      setAccessSettings(result.settings || initialAccessSettings);
      setAdminName(result.settings?.name || "");
      window.localStorage.setItem("bus-booker-admin-name", result.settings?.name || "");
      setMessage({ text: result.message || "Admin sign-in settings saved.", tone: "success" });
    } catch (error) {
      setMessage({ text: error.message || "The server could not be reached.", tone: "error" });
    } finally {
      setSavingAccessSettings(false);
    }
  };

  const saveNotificationSettings = async (event) => {
    event.preventDefault();
    if (!authenticated) return;

    setSavingNotificationSettings(true);
    setSettingsErrors((current) => ({ ...current, adminPhones: "", financePhones: "" }));
    setMessage({ text: "Saving notification contacts...", tone: "neutral" });

    try {
      const response = await fetch("/api/admin/notification-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationSettings),
      });
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout({ silent: true });
          setMessage({ text: "Your admin session has expired. Please sign in again.", tone: "error" });
          return;
        }

        setSettingsErrors((current) => ({
          ...current,
          adminPhones: result.fields?.adminPhones || "",
          financePhones: result.fields?.financePhones || "",
        }));
        setMessage({ text: result.error || "Could not save notification contacts.", tone: "error" });
        return;
      }

      setNotificationSettings(result.settings || initialNotificationSettings);
      setMessage({ text: result.message || "Notification contacts saved.", tone: "success" });
    } catch (error) {
      setMessage({ text: error.message || "The server could not be reached.", tone: "error" });
    } finally {
      setSavingNotificationSettings(false);
    }
  };

  const logout = async ({ silent = false } = {}) => {
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
    } catch {
      // ignore
    }

    clearStoredSession();
    setAuthenticated(false);
    setAdminName("");
    setAccessCode("");
    setFleet([]);
    setBookings([]);
    setNotificationSettings(initialNotificationSettings);
    setAccessSettings(initialAccessSettings);
    setModalBookingId(null);
    setModalDraft({
      adminNotes: "",
      approvingAuthorityName: "",
      driverName: "",
      driverPhone: "",
      selectedVehicleId: "",
    });
    setDecisionErrors(initialDecisionErrors);

    if (!silent) {
      setMessage({ text: "Signed out of the approval desk.", tone: "neutral" });
    }
  };

  const openModal = (booking, { focusDecision = false } = {}) => {
    setModalBookingId(booking.id);
    setModalDraft({
      adminNotes: booking.adminNotes || "",
      approvingAuthorityName: booking.approvingAuthorityName || adminName || "",
      driverName: booking.driverName || "",
      driverPhone: booking.driverPhone || "",
      selectedVehicleId: "",
    });
    setDecisionErrors(initialDecisionErrors);
  };

  const submitDecision = async (decision) => {
    if (!activeBooking) return;

    setDecisionBusy(true);
    setDecisionErrors(initialDecisionErrors);

    try {
      const response = await fetch(`/api/admin/bookings/decision?id=${encodeURIComponent(activeBooking.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminNotes: modalDraft.adminNotes,
          approvingAuthorityName: modalDraft.approvingAuthorityName,
          decision,
          driverName: modalDraft.driverName,
          driverPhone: modalDraft.driverPhone,
          selectedVehicleId: modalDraft.selectedVehicleId,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout({ silent: true });
          setMessage({ text: "Your admin session has expired. Please sign in again.", tone: "error" });
          return;
        }

        setDecisionErrors({
          approvingAuthorityName: result.fields?.approvingAuthorityName || "",
          driverName: result.fields?.driverName || "",
          driverPhone: result.fields?.driverPhone || "",
          selectedVehicleId: result.fields?.selectedVehicleId || "",
        });
        setMessage({ text: result.error || "The decision could not be saved.", tone: "error" });
        return;
      }

      const notificationNotes = (result.notifications?.results || [])
        .map((entry) => `${entry.channel}: ${entry.status}`)
        .join(" | ");

      setMessage({
        text: `${result.message}${notificationNotes ? ` Notification status: ${notificationNotes}.` : ""}`,
        tone: "success",
      });
      setModalBookingId(null);
      await refreshBookings({ preserveModal: false });
    } catch (error) {
      setMessage({ text: error.message || "The server could not be reached.", tone: "error" });
    } finally {
      setDecisionBusy(false);
    }
  };

  const quickDecline = async (booking) => {
    setModalBookingId(booking.id);
    setModalDraft({
      adminNotes: "",
      approvingAuthorityName: adminName || "",
      driverName: "",
      driverPhone: "",
      selectedVehicleId: "",
    });
    await submitDecision("declined");
  };

  const isReleaseStage =
    activeBooking?.status === "awaiting_payment" && activeBooking?.paymentStatus === "confirmed";
  const isWaitingForPayment =
    activeBooking?.status === "awaiting_payment" && activeBooking?.paymentStatus !== "confirmed";
  const activeDecision = activeBooking?.status === "pending" ? "awaiting_payment" : "approved";

  return (
    <>
      <section className="admin-stage admin-stage-auth-only" hidden={authenticated}>
        <section id="authPanel" className="auth-panel">
          <form
            id="adminSignInForm"
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn();
            }}
          >
            <div>
              <p className="eyebrow">Sign In</p>
              <h2 className="font-display text-3xl leading-tight text-slate-900">Open the approval desk</h2>
            </div>

            <label>
              <span>Admin access code</span>
              <input
                id="adminAccessCode"
                type="password"
                placeholder="Enter access code"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                disabled={authBusy}
              />
            </label>

            <label>
              <span>Admin name</span>
              <input
                id="adminName"
                type="text"
                placeholder="Transport secretary"
                value={adminName}
                onChange={(event) => setAdminName(event.target.value)}
                disabled={authBusy}
              />
            </label>

            <button id="signInButton" className="primary-button" type="submit" disabled={authBusy}>
              Sign in
            </button>
            <p className="helper-text">Use the secure code configured for this church deployment.</p>
          </form>
        </section>
      </section>

      <div id="adminMessage" className="form-message" aria-live="polite" data-tone={message.tone || undefined}>
        {message.text}
      </div>

      <section id="adminWorkspace" className="panel admin-workspace" hidden={!authenticated}>
        <div className="workspace-head">
          <div>
            <p className="eyebrow">Approval Workspace</p>
            <h2 className="font-display text-3xl leading-tight text-slate-900">Manage booking requests</h2>
            <p className="panel-copy">
              Signed in as <strong id="activeAdminName">{adminName}</strong>.
            </p>
          </div>

          <div className="workspace-actions">
            <button id="refreshBookingsButton" className="ghost-button" type="button" onClick={() => void refreshBookings()}>
              Refresh
            </button>
            <button id="logoutButton" className="ghost-button" type="button" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </div>

        <div className="summary-grid">
          <SummaryCard label="Pending review" value={summary.pending} primary />
          <SummaryCard label="Awaiting payment" value={summary.awaiting_payment} />
          <SummaryCard label="Released" value={summary.approved} />
          <SummaryCard label="Declined" value={summary.declined} />
        </div>

        <section className="request-table-panel">
          <div className="section-title">
            <h3 className="font-display text-2xl leading-tight text-slate-900">Desk sign-in settings</h3>
          </div>

          <form id="adminAccessSettingsForm" className="panel compact-settings-panel" onSubmit={saveAccessSettings}>
            <p className="panel-copy">
              These values start from environment variables and can be changed here for future admin sign-ins.
            </p>

            <div className="booking-form compact-settings-grid">
              <label>
                <span>Admin name</span>
                <input
                  id="adminSettingsName"
                  type="text"
                  placeholder="Transport secretary"
                  value={accessSettings.name}
                  onChange={(event) => setAccessSettings((current) => ({ ...current, name: event.target.value }))}
                />
                <small id="adminSettingsNameError">{settingsErrors.adminName}</small>
              </label>

              <label>
                <span>Admin access code</span>
                <input
                  id="adminSettingsAccessCode"
                  type="text"
                  placeholder="Enter admin access code"
                  value={accessSettings.accessCode}
                  onChange={(event) => setAccessSettings((current) => ({ ...current, accessCode: event.target.value }))}
                />
                <small id="adminSettingsAccessCodeError">{settingsErrors.accessCode}</small>
              </label>
            </div>

            <div className="workspace-actions">
              <button
                id="saveAdminAccessSettingsButton"
                className="primary-button"
                type="submit"
                disabled={savingAccessSettings}
              >
                Save sign-in settings
              </button>
            </div>
          </form>
        </section>

        <section className="request-table-panel">
          <div className="section-title">
            <h3 className="font-display text-2xl leading-tight text-slate-900">Notification contacts</h3>
          </div>

          <form id="notificationSettingsForm" className="panel compact-settings-panel" onSubmit={saveNotificationSettings}>
            <p className="panel-copy">
              Add the phone numbers that should receive workflow SMS updates. Use one number per line or separate
              with commas.
            </p>

            <div className="booking-form compact-settings-grid">
              <label>
                <span>Admin release contacts</span>
                <textarea
                  id="adminContactPhones"
                  rows="4"
                  placeholder={"0241234567\n0207654321"}
                  value={formatPhoneList(notificationSettings.adminPhones)}
                  onChange={(event) =>
                    setNotificationSettings((current) => ({
                      ...current,
                      adminPhones: event.target.value,
                    }))
                  }
                />
                <small id="adminContactPhonesError">{settingsErrors.adminPhones}</small>
              </label>

              <label>
                <span>Finance contacts</span>
                <textarea
                  id="financeContactPhones"
                  rows="4"
                  placeholder={"0551234567\n0267654321"}
                  value={formatPhoneList(notificationSettings.financePhones)}
                  onChange={(event) =>
                    setNotificationSettings((current) => ({
                      ...current,
                      financePhones: event.target.value,
                    }))
                  }
                />
                <small id="financeContactPhonesError">{settingsErrors.financePhones}</small>
              </label>
            </div>

            <div className="workspace-actions">
              <button
                id="saveNotificationSettingsButton"
                className="primary-button"
                type="submit"
                disabled={savingNotificationSettings}
              >
                Save contacts
              </button>
            </div>
          </form>
        </section>

        <section className="request-table-panel">
          <div className="section-title">
            <h3 className="font-display text-2xl leading-tight text-slate-900">All requests</h3>
            <span id="requestTableCount" className="count-pill">
              {bookings.length}
            </span>
          </div>

          <div className="request-table-wrap">
            <table className="request-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Member</th>
                  <th>Organisation</th>
                  <th>Booking</th>
                  <th>Status</th>
                  <th>Stage note</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="requestTableBody">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="table-empty">
                      No requests found yet.
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => (
                    <AdminRow
                      key={booking.id}
                      booking={booking}
                      onOpen={() => openModal(booking)}
                      onQuickDecline={() => void quickDecline(booking)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {activeBooking ? (
        <dialog open id="requestModal" className="booking-dialog request-modal" aria-labelledby="requestModalTitle">
          <div className="dialog-shell request-modal-shell">
            <div className="dialog-head">
              <div>
                <p className="eyebrow">Request Details</p>
                <h2 id="requestModalTitle" className="font-display text-3xl leading-tight text-slate-900">
                  {activeBooking.eventName || "Booking request"}
                </h2>
                <p id="requestModalMeta" className="panel-copy">
                  {formatDateRange(getFromDate(activeBooking), getToDate(activeBooking))} • {formatSlot(activeBooking)} •{" "}
                  {activeBooking.requesterName}
                </p>
              </div>
              <button
                id="closeRequestModalButton"
                className="icon-button"
                type="button"
                aria-label="Close request details"
                onClick={() => setModalBookingId(null)}
              >
                ×
              </button>
            </div>

            <div className="request-modal-grid">
              <section className="request-modal-card">
                <dl id="requestModalDetails" className="booking-details request-modal-details">
                  {buildAdminDetails(activeBooking).map(([term, value]) => (
                    <FragmentPair key={term} term={term} value={value} />
                  ))}
                </dl>
              </section>

              <section className="request-modal-card">
                {activeBooking.status === "pending" || activeBooking.status === "awaiting_payment" ? (
                  <div id="requestModalDecisionPanel" className="decision-block modal-decision-block">
                    <label className="vehicle-field" hidden={!isReleaseStage}>
                      <span>Assign bus</span>
                      <select
                        id="requestModalVehicleSelect"
                        value={modalDraft.selectedVehicleId}
                        onChange={(event) =>
                          setModalDraft((current) => ({ ...current, selectedVehicleId: event.target.value }))
                        }
                        disabled={!isReleaseStage || (activeBooking.availableVehicles || []).length === 0}
                      >
                        <option value="">
                          {(activeBooking.availableVehicles || []).length > 0
                            ? "Select available bus"
                            : "No available buses for this request"}
                        </option>
                        {(activeBooking.availableVehicles || []).map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.label} ({vehicle.number})
                          </option>
                        ))}
                      </select>
                      <small id="requestModalVehicleError">
                        {isWaitingForPayment ? "Finance must confirm payment before release." : decisionErrors.selectedVehicleId}
                      </small>
                    </label>
                    <label hidden={!isReleaseStage}>
                      <span>Driver name</span>
                      <input
                        id="requestModalDriverName"
                        type="text"
                        placeholder="Assigned driver"
                        value={modalDraft.driverName}
                        onChange={(event) =>
                          setModalDraft((current) => ({ ...current, driverName: event.target.value }))
                        }
                      />
                      <small id="requestModalDriverNameError">{decisionErrors.driverName}</small>
                    </label>
                    <label hidden={!isReleaseStage}>
                      <span>Driver phone</span>
                      <input
                        id="requestModalDriverPhone"
                        type="tel"
                        inputMode="numeric"
                        maxLength="10"
                        placeholder="0241234567"
                        value={modalDraft.driverPhone}
                        onChange={(event) =>
                          setModalDraft((current) => ({
                            ...current,
                            driverPhone: event.target.value.replace(/\D/g, "").slice(0, 10),
                          }))
                        }
                      />
                      <small id="requestModalDriverPhoneError">{decisionErrors.driverPhone}</small>
                    </label>
                    <label hidden={!isReleaseStage}>
                      <span>Approving authority</span>
                      <input
                        id="requestModalApprovingAuthority"
                        type="text"
                        placeholder="Approving authority name"
                        value={modalDraft.approvingAuthorityName}
                        onChange={(event) =>
                          setModalDraft((current) => ({ ...current, approvingAuthorityName: event.target.value }))
                        }
                      />
                      <small id="requestModalApprovingAuthorityError">{decisionErrors.approvingAuthorityName}</small>
                    </label>
                    <label>
                      <span>Admin note</span>
                      <textarea
                        id="requestModalAdminNote"
                        rows="4"
                        placeholder="Optional note to the requester"
                        value={modalDraft.adminNotes}
                        onChange={(event) =>
                          setModalDraft((current) => ({ ...current, adminNotes: event.target.value }))
                        }
                      />
                    </label>
                    <div className="decision-actions">
                      <button
                        id="requestModalApproveButton"
                        type="button"
                        className="primary-button"
                        disabled={decisionBusy || isWaitingForPayment}
                        onClick={() => void submitDecision(activeDecision)}
                      >
                        {activeBooking.status === "pending"
                          ? "Approve to pay"
                          : isReleaseStage
                            ? "Release bus"
                            : "Waiting for payment"}
                      </button>
                      <button
                        id="requestModalDeclineButton"
                        type="button"
                        className="ghost-button"
                        disabled={decisionBusy}
                        onClick={() => void submitDecision("declined")}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ) : (
                  <div id="requestModalProcessedPanel" className="request-processed-panel">
                    <p className="feature-label">Request stage</p>
                    <p id="requestModalProcessedText" className="panel-copy">
                      {activeBooking.processedAt
                        ? `Processed by ${activeBooking.processedBy || "Unknown"} on ${formatDateTime(activeBooking.processedAt)}.`
                        : "This request has already been processed."}
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}

function SummaryCard({ label, primary = false, value }) {
  return (
    <article className={`summary-card${primary ? " summary-card-primary" : ""}`}>
      <span className="summary-label">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AdminRow({ booking, onOpen, onQuickDecline }) {
  return (
    <tr data-status={booking.status}>
      <td>
        <div className="table-primary">{formatDateRange(getFromDate(booking), getToDate(booking))}</div>
        <div className="table-secondary">{formatSlot(booking)}</div>
      </td>
      <td>
        <div className="table-primary">{booking.requesterName}</div>
        <div className="table-secondary">{booking.membershipNumber || "No membership number"}</div>
      </td>
      <td>{booking.ministryName || "Not provided"}</td>
      <td>{booking.eventName || "Untitled request"}</td>
      <td>
        <span className="status-badge" data-status={booking.status}>
          {getStatusLabel(booking.status)}
        </span>
      </td>
      <td>{getStageNote(booking)}</td>
      <td>
        <div className="row-actions">
          <button type="button" className="ghost-button row-button" onClick={onOpen}>
            Open
          </button>
          {booking.status === "pending" || booking.status === "awaiting_payment" ? (
            <>
              <button
                type="button"
                className="primary-button row-button"
                disabled={booking.status === "awaiting_payment" && booking.paymentStatus !== "confirmed"}
                onClick={onOpen}
              >
                {booking.status === "pending"
                  ? "Approve to pay"
                  : booking.paymentStatus === "confirmed"
                    ? "Release bus"
                    : "Waiting for payment"}
              </button>
              <button type="button" className="ghost-button row-button" onClick={onQuickDecline}>
                Decline
              </button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function FragmentPair({ term, value }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </>
  );
}

function buildAdminDetails(booking) {
  const detailPairs = [
    ["Member", booking.requesterName],
    ["Membership no.", booking.membershipNumber || "Not provided"],
    ["Ministry", booking.ministryName],
    ["Email", booking.requesterEmail || "Not provided"],
    ["Phone", booking.phone || "Not provided"],
    ["From date", formatDate(getFromDate(booking))],
    ["Start time", booking.startTime || "Not provided"],
    ["To date", formatDate(getToDate(booking))],
    ["End time", booking.endTime || "Not provided"],
    ["Pickup", booking.pickupLocation],
    ["End location", booking.endLocation || booking.pickupLocation || "Not provided"],
    ["Destination", booking.destination],
    ["Passengers", String(booking.passengerCount || 0)],
    ["Purpose", booking.purpose],
    ["Notes", booking.notes || "None"],
    ["Terms accepted", booking.termsAccepted ? "Yes" : "No"],
    ["Amount charged", formatMoney(booking.amountCharged)],
    ["Amount paid", formatMoney(booking.amountPaid)],
    ["Balance", formatMoney(booking.balance)],
    ["Payment status", booking.paymentStatus || "pending"],
    ["Tracking code", booking.trackingCode || "Not available"],
    ["Submitted", formatDateTime(booking.submittedAt)],
    ["Status", getStatusLabel(booking.status)],
  ];

  if (booking.assignedVehicleLabel) {
    detailPairs.push(["Assigned bus", booking.assignedVehicleLabel]);
  }

  if (booking.processedAt) {
    detailPairs.push(["Approving authority", booking.approvingAuthorityName || "Not provided"]);
    detailPairs.push(["Vehicle reg. no.", booking.vehicleRegNo || "Not assigned"]);
    detailPairs.push(["Driver", booking.driverName || "Not assigned"]);
    detailPairs.push(["Driver phone", booking.driverPhone || "Not assigned"]);
    detailPairs.push(["Processed by", booking.processedBy || "Unknown"]);
    detailPairs.push(["Processed at", formatDateTime(booking.processedAt)]);
    detailPairs.push(["Admin note", booking.adminNotes || "None"]);
  }

  return detailPairs;
}

function getFromDate(booking) {
  return booking.fromDate || booking.travelDate;
}

function getToDate(booking) {
  return booking.toDate || booking.travelDate;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function formatDateRange(fromDate, toDate) {
  return fromDate === toDate ? formatDate(fromDate) : `${formatDate(fromDate)} to ${formatDate(toDate)}`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatSlot(booking) {
  if (booking.bookingType === "full_day") return "Full day";
  return booking.timeSlot === "morning" ? "Half day • morning" : "Half day • afternoon";
}

function getStatusLabel(status) {
  if (status === "awaiting_payment") return "Awaiting payment";
  if (status === "approved") return "Released";
  if (status === "declined") return "Declined";
  return "Pending review";
}

function getStageNote(booking) {
  if (booking.status === "pending") return `${booking.availableVehicles?.length || 0} available for review`;
  if (booking.status === "awaiting_payment") {
    return booking.paymentStatus === "confirmed" ? "Payment confirmed, ready to release" : "Waiting for finance";
  }
  if (booking.status === "approved") return booking.assignedVehicleLabel || "Bus released";
  if (booking.status === "declined") return "Not released";
  return "Review needed";
}

function formatMoney(value) {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `GH₵ ${safeAmount.toFixed(2)}`;
}

function formatPhoneList(list) {
  if (Array.isArray(list)) return list.join("\n");
  return String(list || "");
}

function clearStoredSession() {
  window.localStorage.removeItem("bus-booker-admin-name");
}
