"use client";

import type { BusinessProfileInput } from "@/modules/operations/settings-service";

type PublicProfileFieldsProps = {
  value: BusinessProfileInput;
  disabled: boolean;
  onChange: (value: BusinessProfileInput) => void;
};

export function PublicProfileFields({ value, disabled, onChange }: PublicProfileFieldsProps) {
  function updateLink(key: "locationUrl" | "instagramUrl" | "whatsappUrl", link: string) {
    onChange({ ...value, [key]: link.trim() || null });
  }

  return (
    <div className="transfer-fields">
      <label className="form-field">
        <span>Nombre del local</span>
        <input
          className="form-input"
          disabled={disabled}
          maxLength={120}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          required
          value={value.name}
        />
      </label>
      <label className="form-field">
        <span>Ubicación en Google Maps</span>
        <input
          className="form-input"
          disabled={disabled}
          maxLength={500}
          onChange={(event) => updateLink("locationUrl", event.target.value)}
          placeholder="https://maps.google.com/..."
          type="url"
          value={value.locationUrl ?? ""}
        />
      </label>
      <label className="form-field">
        <span>Instagram</span>
        <input
          className="form-input"
          disabled={disabled}
          maxLength={500}
          onChange={(event) => updateLink("instagramUrl", event.target.value)}
          placeholder="https://instagram.com/tu-local"
          type="url"
          value={value.instagramUrl ?? ""}
        />
      </label>
      <label className="form-field">
        <span>WhatsApp</span>
        <input
          className="form-input"
          disabled={disabled}
          maxLength={500}
          onChange={(event) => updateLink("whatsappUrl", event.target.value)}
          placeholder="https://wa.me/549..."
          type="url"
          value={value.whatsappUrl ?? ""}
        />
      </label>
    </div>
  );
}
