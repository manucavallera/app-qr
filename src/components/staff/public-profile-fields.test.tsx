// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicProfileFields } from "./public-profile-fields";

afterEach(cleanup);

describe("PublicProfileFields", () => {
  it("updates the business name and renders links as URL fields", () => {
    const profile = {
      name: "Bar",
      locationUrl: "https://maps.google.com/?q=bar",
      instagramUrl: null,
      whatsappUrl: "https://wa.me/5491100000000",
    };
    const onChange = vi.fn();

    render(<PublicProfileFields value={profile} disabled={false} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Nombre del local"), { target: { value: "Bar Nuevo" } });

    expect(onChange).toHaveBeenCalledWith({ ...profile, name: "Bar Nuevo" });
    expect(screen.getByLabelText("WhatsApp")).toHaveAttribute("type", "url");
  });

  it("normalizes an empty public link to null", () => {
    const profile = { name: "Bar", locationUrl: null, instagramUrl: "https://instagram.com/bar", whatsappUrl: null };
    const onChange = vi.fn();

    render(<PublicProfileFields value={profile} disabled={false} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Instagram"), { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith({ ...profile, instagramUrl: null });
  });
});
