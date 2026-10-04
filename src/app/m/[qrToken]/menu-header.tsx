import { Clock, InstagramLogo, MapPin, WhatsappLogo } from "@phosphor-icons/react/ssr";

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

const icons = { location: MapPin, instagram: InstagramLogo, whatsapp: WhatsappLogo } as const;

export function MenuHeader({ business, hoursLabel }: MenuHeaderProps) {
  const actions = [
    { type: "location" as const, label: "Cómo llegar", href: business.locationUrl },
    { type: "instagram" as const, label: "Instagram", href: business.instagramUrl },
    { type: "whatsapp" as const, label: "WhatsApp", href: business.whatsappUrl },
  ].filter((action): action is typeof action & { href: string } => Boolean(action.href));

  return (
    <>
      <div className="cm-topbar">
        <p className="cm-brand">{business.name}</p>
        {actions.length > 0 && (
          <nav className="cm-social" aria-label="Contacto del local">
            {actions.map((action) => {
              const Icon = icons[action.type];
              return (
                <a key={action.type} href={action.href} target="_blank" rel="noreferrer" aria-label={action.label}>
                  <Icon size={22} weight="bold" aria-hidden="true" />
                </a>
              );
            })}
          </nav>
        )}
      </div>
      {hoursLabel && (
        <p className="cm-hours" aria-label={`Horario de atención: ${hoursLabel}`}>
          <Clock size={18} weight="bold" aria-hidden="true" />
          <span><small>Horario de hoy</small>{hoursLabel}</span>
        </p>
      )}
    </>
  );
}
