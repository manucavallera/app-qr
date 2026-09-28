// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSseResource } from "./use-sse-resource";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  readyState = 1; // OPEN
  private listeners = new Map<string, (() => void)[]>();
  constructor() {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  dispatchEvent(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }
  close() {}
}

afterEach(() => {
  FakeEventSource.instances = [];
  vi.unstubAllGlobals();
});

describe("useSseResource", () => {
  it("refetches after opening the stream", () => {
    const refetch = vi.fn();
    vi.stubGlobal("EventSource", FakeEventSource);
    renderHook(() => useSseResource("/events", refetch));
    expect(refetch).toHaveBeenCalled();
  });

  it("does not refetch on onerror (browser reconnects automatically)", () => {
    const refetch = vi.fn();
    class CaptureFakeEventSource extends FakeEventSource {
      constructor(url: string) { super(); void url; }
    }
    vi.stubGlobal("EventSource", CaptureFakeEventSource);
    renderHook(() => useSseResource("/events", refetch));
    const instance = FakeEventSource.instances.at(-1)!;
    const callsBefore = refetch.mock.calls.length;
    // Simulate a network error from the EventSource
    if (instance.onerror) instance.onerror(new Event("error"));
    // refetch count must NOT increase
    expect(refetch.mock.calls.length).toBe(callsBefore);
  });

  it("does not refetch after unmount (active guard)", () => {
    const refetch = vi.fn();
    class CaptureFakeEventSource extends FakeEventSource {
      constructor(url: string) { super(); void url; }
    }
    vi.stubGlobal("EventSource", CaptureFakeEventSource);
    const { unmount } = renderHook(() => useSseResource("/events", refetch));
    const instance = FakeEventSource.instances.at(-1)!;
    unmount();
    const callsBefore = refetch.mock.calls.length;
    // Simulate order.changed after unmount
    instance.dispatchEvent("order.changed");
    expect(refetch.mock.calls.length).toBe(callsBefore);
  });
});
