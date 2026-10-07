"use client";

import Image from "next/image";
import { useRef, useState } from "react";

/** Product photos as a swipeable strip; with one photo it is just the picture. */
export function ProductGallery({ urls, name }: { urls: readonly string[]; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  if (urls.length === 0) return null;

  function goTo(index: number) {
    const element = track.current;
    if (element) element.scrollTo({ left: index * element.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="cm-gallery" role="group" aria-roledescription="carrusel" aria-label={`Fotos de ${name}`}>
      <div
        className="cm-gallery-track"
        ref={track}
        onScroll={(event) => setCurrent(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}
      >
        {urls.map((url, index) => (
          <div className="cm-gallery-slide" key={url} aria-label={`Foto ${index + 1} de ${urls.length}`}>
            <Image src={url} alt="" fill sizes="(min-width: 560px) 560px, 100vw" priority={index === 0} unoptimized />
          </div>
        ))}
      </div>
      {urls.length > 1 && (
        <div className="cm-gallery-dots">
          {urls.map((url, index) => (
            <button
              key={url}
              type="button"
              className={index === current ? "is-active" : undefined}
              aria-label={`Ver foto ${index + 1} de ${urls.length}`}
              aria-current={index === current ? "true" : undefined}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
