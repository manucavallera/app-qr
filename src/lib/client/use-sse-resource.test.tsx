// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSseResource } from "./use-sse-resource";

describe("useSseResource", () => {
  it("refetches after opening the stream", () => {
    const refetch = vi.fn();
    class FakeEventSource { onopen: (() => void) | null = null; onerror: (() => void) | null = null; onmessage: (() => void) | null = null; addEventListener() {} close() {} }
    vi.stubGlobal("EventSource", FakeEventSource);
    renderHook(() => useSseResource("/events", refetch));
    expect(refetch).toHaveBeenCalled();
  });
});
