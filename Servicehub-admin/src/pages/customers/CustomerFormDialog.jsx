import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../context/ToastContext";
import { useCreateCustomer, useUpdateCustomer } from "../../hooks/useCustomers";
import { errorMessage, fieldErrors } from "../../lib/api";

const PHONE_PATTERN = /^\+?[\d\s().-]{7,25}$/;

function CustomerForm({ customer, onClose, onSaved }) {
  const isEdit = Boolean(customer);
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    area: customer?.area ?? "",
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer(customer?._id);
  const mutation = isEdit ? updateMutation : createMutation;

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  function handleSubmit() {
    const nextErrors = {};
    if (form.name.trim().length < 2) nextErrors.name = "Enter the customer's full name";
    if (!PHONE_PATTERN.test(form.phone.trim())) nextErrors.phone = "Enter a valid phone number";
    if (form.area.trim().length < 2) nextErrors.area = "Enter the customer's area";
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;

    mutation.mutate(
      { name: form.name.trim(), phone: form.phone.trim(), area: form.area.trim() },
      {
        onSuccess: (detail) => {
          toast.success(isEdit ? `${detail.customer.name} updated.` : `${detail.customer.name} added.`);
          onSaved?.(detail.customer);
          onClose();
        },
        onError: (error) => {
          const apiErrors = fieldErrors(error);
          if (Object.keys(apiErrors).length > 0) setErrors(apiErrors);
          else setFormError(errorMessage(error));
        },
      }
    );
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={isEdit ? `Edit ${customer.name}` : "Add customer"}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Add customer"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-left">
        <FormField label="Full name" error={errors.name}>
          <Input value={form.name} onChange={update("name")} autoComplete="off" />
        </FormField>
        <FormField label="Phone" error={errors.phone}>
          <Input type="tel" value={form.phone} onChange={update("phone")} placeholder="+1 512-555-0100" />
        </FormField>
        <FormField label="Area" error={errors.area}>
          <Input value={form.area} onChange={update("area")} placeholder="e.g. South Congress" />
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

export function CustomerFormDialog({ open, ...props }) {
  return open ? <CustomerForm {...props} /> : null;
}
