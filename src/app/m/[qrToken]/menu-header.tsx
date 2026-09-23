export type PublicBusiness = Readonly<{
  name: string;
  locationUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
}>;

type MenuHeaderProps = Readonly<{
  business: PublicBusiness;
  hoursLabel: string | null;
}>;

type ContactType = "location" | "instagram" | "whatsapp";

function MenuIcon({ type }: { type: ContactType }) {
  if (type === "location") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.4" /></svg>;
  }

  if (type === "instagram") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.7" r=".8" className="menu-icon-fill" /></svg>;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.8 4.2A10.1 10.1 0 0 0 12 1.1C6.1 1.1 1.3 5.9 1.3 11.8c0 1.9.5 3.7 1.4 5.3L1.2 22.9l5.9-1.5a10.7 10.7 0 0 0 4.9 1.2h.1c5.9 0 10.7-4.8 10.7-10.7 0-2.9-1.1-5.7-3-7.7Zm-7.8 16.3h-.1a8.8 8.8 0 0 1-4.5-1.2l-.3-.2-3.5.9.9-3.4-.2-.4a8.5 8.5 0 0 1-1.3-4.5A8.9 8.9 0 0 1 12 2.9a8.8 8.8 0 0 1 6.3 2.6 8.8 8.8 0 0 1 2.6 6.3 8.9 8.9 0 0 1-8.9 8.7Z" /><path d="M16.8 14.8c-.3-.2-1.6-.8-1.9-.9-.2-.1-.4-.2-.6.2-.2.3-.7.9-.8 1.1-.2.2-.3.2-.6.1-1.6-.8-2.6-1.4-3.6-3.2-.3-.5.3-.5.8-1.6.1-.2.1-.4 0-.6 0-.2-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.3 3.8 1.6.7 2.2.7 3 .6.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.1.1-1.2Z" className="menu-icon-fill" /></svg>;
}

export function MenuHeader({ business, hoursLabel }: MenuHeaderProps) {
  const actions = [
    { type: "location" as const, label: "Cómo llegar", href: business.locationUrl },
    { type: "instagram" as const, label: "Instagram", href: business.instagramUrl },
    { type: "whatsapp" as const, label: "WhatsApp", href: business.whatsappUrl },
  ].filter((action): action is typeof action & { href: string } => Boolean(action.href));

  return (
    <div className="menu-header-tools">
      <div className="menu-brand-row">
        <p className="menu-brand">{business.name}</p>
        {actions.length > 0 && (
          <nav className="menu-social-links" aria-label="Contacto del local">
            {actions.map((action) => (
              <a
                key={action.type}
                href={action.href}
                target="_blank"
                rel="noreferrer"
                aria-label={action.label}
              >
                <MenuIcon type={action.type} />
              </a>
            ))}
          </nav>
        )}
      </div>
      {hoursLabel && (
        <div className="menu-hours" aria-label={`Horario de atención: ${hoursLabel}`}>
          <span className="menu-hours-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg></span>
          <span><small>Horario de hoy</small>{hoursLabel}</span>
        </div>
      )}
    </div>
  );
}
