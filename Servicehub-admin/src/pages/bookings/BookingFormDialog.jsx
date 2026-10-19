import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { SearchSelect } from "../../components/ui/SearchSelect";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useCreateBooking, useUpdateBooking } from "../../hooks/useBookings";
import { useAppConfig } from "../../hooks/useConfig";
import { useCustomerOptions } from "../../hooks/usePickerOptions";
import { useProviders } from "../../hooks/useProviders";
import { errorMessage, fieldErrors } from "../../lib/api";
import { toDateTimeInputValue } from "../../lib/formatters";
import { can } from "../../lib/permissions";

function defaultSchedule() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return toDateTimeInputValue(date);
}

function validate(form, isEdit) {
  const errors = {};
  if (!isEdit && !form.customer) errors.customerId = "Pick a customer";
  if (!isEdit && !form.service) errors.service = "Pick a service";
  if (!form.scheduledAt || Number.isNaN(new Date(form.scheduledAt).getTime())) {
    errors.scheduledAt = "Enter a valid date and time";
  }
  const amount = Number(form.amount);
  if (!form.amount || !Number.isFinite(amount) || amount <= 0) errors.amount = "Enter an amount greater than zero";
  else if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) errors.amount = "Use at most two decimals";
  if (form.address.trim().length < 5) errors.address = "Enter the full service address";
  return errors;
}

// Create mode (no `booking`): customer (optionally preselected), service,
// optional provider and the job details. Edit mode: reschedule or correct
// amount/address of an open booking.
function BookingForm({ booking, initialCustomer, onClose, onSaved }) {
  const isEdit = Boolean(booking);
  const { user } = useAuth();
  const toast = useToast();
  const { services } = useAppConfig();
  const [form, setForm] = useState(() => ({
    customer: initialCustomer ?? null,
    service: "",
    providerId: "",
    scheduledAt: booking ? toDateTimeInputValue(booking.scheduledAt) : defaultSchedule(),
    amount: booking ? String(booking.amount) : "",
    address: booking?.address ?? "",
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const createMutation = useCreateBooking();
  const updateMutation = useUpdateBooking(booking?._id);
  const mutation = isEdit ? updateMutation : createMutation;

  const canPickProvider = !isEdit && can(user, "provider.read");
  const providersQuery = useProviders(
    { service: form.service, availableOnly: "true", limit: 50 },
    { enabled: canPickProvider && Boolean(form.service) }
  );
  const providers = form.service ? (providersQuery.data?.items ?? []) : [];

  function update(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      // A provider is only valid for the service it was picked for.
      ...(field === "service" ? { providerId: "" } : {}),
    }));
  }

  function handleSubmit() {
    const nextErrors = validate(form, isEdit);
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;

    const scheduledAt = new Date(form.scheduledAt).toISOString();
    const body = isEdit
      ? { scheduledAt, amount: Number(form.amount), address: form.address.trim() }
      : {
          customerId: form.customer._id,
          service: form.service,
          scheduledAt,
          amount: Number(form.amount),
          address: form.address.trim(),
          ...(form.providerId ? { providerId: form.providerId } : {}),
        };

    mutation.mutate(body, {
      onSuccess: (saved) => {
        toast.success(isEdit ? `Booking ${saved.code} updated.` : `Booking ${saved.code} created.`);
        onSaved?.(saved);
        onClose();
      },
      onError: (error) => {
        const apiErrors = fieldErrors(error);
        if (Object.keys(apiErrors).length > 0) setErrors(apiErrors);
        else setFormError(errorMessage(error));
      },
    });
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={isEdit ? `Edit ${booking.code}` : "New booking"}
      description={isEdit ? "Reschedule the visit or correct its details." : "Book a service on a customer's behalf."}
      widthClassName="max-w-lg"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create booking"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-left">
        {!isEdit && (
          <>
            <FormField label="Customer" error={errors.customerId}>
              <SearchSelect
                value={form.customer}
                onChange={(customer) => update("customer", customer)}
                useOptions={useCustomerOptions}
                getKey={(customer) => customer._id}
                placeholder="Search by name or phone…"
                emptyText="No customers match"
                renderOption={(customer) => (
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="truncate text-text-primary">{customer.name}</span>
                    <span className="font-data shrink-0 text-[11px] text-text-secondary">{customer.phone}</span>
                  </span>
                )}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Service" error={errors.service}>
                <Select value={form.service} onChange={(event) => update("service", event.target.value)}>
                  <option value="">Select a service</option>
                  {services.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </Select>
              </FormField>

              {canPickProvider && (
                <FormField
                  label="Provider (optional)"
                  hint={form.service && providers.length === 0 && !providersQuery.isFetching ? "No available providers for this service." : undefined}
                  error={errors.providerId}
                >
                  <Select
                    value={form.providerId}
                    onChange={(event) => update("providerId", event.target.value)}
                    disabled={!form.service}
                  >
                    <option value="">Assign later</option>
                    {providers.map((provider) => (
                      <option key={provider._id} value={provider._id}>
                        {provider.name} · {provider.rating.toFixed(1)}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
            </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Scheduled for" error={errors.scheduledAt}>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) => update("scheduledAt", event.target.value)}
            />
          </FormField>
          <FormField label="Amount (USD)" error={errors.amount}>
            <Input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => update("amount", event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Service address" error={errors.address}>
          <Input
            value={form.address}
            onChange={(event) => update("address", event.target.value)}
            placeholder="Street, area, city"
            autoComplete="street-address"
          />
        </FormField>

        {formError && (
          <p role="alert" className="text-[13px] text-danger">
            {formError}
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}

// Mounted only while open, so every opening starts from a fresh form.
export function BookingFormDialog({ open, ...props }) {
  return open ? <BookingForm {...props} /> : null;
}
