import clsx from "clsx";
import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Checkbox } from "../../components/ui/Checkbox";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../context/ToastContext";
import { useAppConfig } from "../../hooks/useConfig";
import { useCreateProvider, useUpdateProvider } from "../../hooks/useProviders";
import { errorMessage, fieldErrors } from "../../lib/api";

const PHONE_PATTERN = /^\+?[\d\s().-]{7,25}$/;

function ProviderForm({ provider, onClose, onSaved }) {
  const isEdit = Boolean(provider);
  const toast = useToast();
  const { services: allServices } = useAppConfig();
  const [form, setForm] = useState(() => ({
    name: provider?.name ?? "",
    phone: provider?.phone ?? "",
    area: provider?.area ?? "",
    services: provider?.services ?? [],
    isAvailable: provider?.isAvailable ?? true,
    verified: provider?.verified ?? false,
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const createMutation = useCreateProvider();
  const updateMutation = useUpdateProvider(provider?._id);
  const mutation = isEdit ? updateMutation : createMutation;

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleService(service) {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((item) => item !== service)
        : [...prev.services, service],
    }));
  }

  function handleSubmit() {
    const nextErrors = {};
    if (form.name.trim().length < 2) nextErrors.name = "Enter the provider's full name";
    if (!PHONE_PATTERN.test(form.phone.trim())) nextErrors.phone = "Enter a valid phone number";
    if (form.area.trim().length < 2) nextErrors.area = "Enter the area they cover";
    if (form.services.length === 0) nextErrors.services = "Pick at least one service";
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;

    const body = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      area: form.area.trim(),
      services: form.services,
      isAvailable: form.isAvailable,
      verified: form.verified,
    };

    mutation.mutate(body, {
      onSuccess: (detail) => {
        toast.success(isEdit ? `${detail.provider.name} updated.` : `${detail.provider.name} added.`);
        onSaved?.(detail.provider);
        onClose();
      },
      onError: (error) => {
        const apiErrors = fieldErrors(error);
        if (Object.keys(apiErrors).length > 0) {
          setErrors({ ...apiErrors, services: apiErrors.services ?? apiErrors["services.0"] });
        } else {
          setFormError(errorMessage(error));
        }
      },
    });
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={isEdit ? `Edit ${provider.name}` : "Add provider"}
      widthClassName="max-w-lg"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Add provider"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-left">
        <FormField label="Full name" error={errors.name}>
          <Input value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="off" />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Phone" error={errors.phone}>
            <Input
              type="tel"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="+1 512-555-0100"
            />
          </FormField>
          <FormField label="Area" error={errors.area}>
            <Input value={form.area} onChange={(event) => update("area", event.target.value)} placeholder="e.g. Hyde Park" />
          </FormField>
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-[13px] text-text-secondary">Services</legend>
          <div className="flex flex-wrap gap-1.5" role="group">
            {allServices.map((service) => {
              const selected = form.services.includes(service);
              return (
                <button
                  key={service}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleService(service)}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-btn border px-2.5 py-1 text-[12px] transition-colors",
                    selected
                      ? "border-accent/30 bg-accent/10 text-accent"
                      : "border-border bg-surface text-text-secondary hover:text-text-primary"
                  )}
                >
                  {selected && <Check size={12} />}
                  {service}
                </button>
              );
            })}
          </div>
          {errors.services && <p className="mt-1 text-[12px] text-danger">{errors.services}</p>}
        </fieldset>

        <div className="flex flex-wrap gap-5">
          <Checkbox
            label="Available for new jobs"
            checked={form.isAvailable}
            onChange={(event) => update("isAvailable", event.target.checked)}
          />
          <Checkbox
            label="Verified (background check passed)"
            checked={form.verified}
            onChange={(event) => update("verified", event.target.checked)}
          />
        </div>

        {formError && (
          <p role="alert" className="text-[13px] text-danger">
            {formError}
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}

export function ProviderFormDialog({ open, ...props }) {
  return open ? <ProviderForm {...props} /> : null;
}
